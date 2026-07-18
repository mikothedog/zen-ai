package zenai

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func writeNDJSON(w http.ResponseWriter, chunks []ollamaChatResponse) {
	for _, c := range chunks {
		data, _ := json.Marshal(c)
		fmt.Fprintln(w, string(data))
	}
}

func TestStreamOllamaChatToolLoop(t *testing.T) {
	var callCount int

	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body, _ := io.ReadAll(r.Body)
		var req ollamaRequest
		json.Unmarshal(body, &req)

		callCount++
		w.Header().Set("Content-Type", "application/x-ndjson")

		if callCount == 1 {
			args, _ := json.Marshal(toolArgs{Command: "echo hello"})
			writeNDJSON(w, []ollamaChatResponse{
				{
					Message: ollamaMessage{
						Content: "Let me run that...",
						ToolCalls: []ToolCall{
							{
								ID: "call_test_1",
								Function: ToolCallFunction{
									Index:     0,
									Name:      "run_command",
									Arguments: args,
								},
							},
						},
					},
					Done: true,
				},
			})
			return
		}

		if callCount == 2 {
			var hasToolResult bool
			for _, m := range req.Messages {
				if m.Role == "tool" && strings.Contains(m.Content, "hello") {
					hasToolResult = true
				}
			}
			if !hasToolResult {
				t.Error("second request missing tool result message")
			}

			writeNDJSON(w, []ollamaChatResponse{
				{Message: ollamaMessage{Content: "The result is: "}, Done: false},
				{Message: ollamaMessage{Content: "hello"}, Done: false},
				{Message: ollamaMessage{Content: ""}, Done: true},
			})
			return
		}

		t.Errorf("unexpected call #%d", callCount)
	}))
	defer mock.Close()

	originalURL := OllamaBaseURL
	OllamaBaseURL = mock.URL
	defer func() { OllamaBaseURL = originalURL }()

	rec := httptest.NewRecorder()
	err := StreamOllamaChat(rec, ChatRequest{
		Model: "test-model",
		Messages: []Message{
			{Role: "user", Content: "run something"},
		},
	})
	if err != nil {
		t.Fatal(err)
	}

	if callCount != 2 {
		t.Errorf("expected 2 calls to mock, got %d", callCount)
	}

	lines := strings.Split(strings.TrimSpace(rec.Body.String()), "\n")
	var chunks []chatChunk
	for _, line := range lines {
		var c chatChunk
		if err := json.Unmarshal([]byte(line), &c); err != nil {
			t.Fatal(err)
		}
		chunks = append(chunks, c)
	}

	if len(chunks) < 2 {
		t.Fatalf("expected at least 2 output chunks, got %d", len(chunks))
	}

	var fullContent string
	var gotFinalDone bool
	for i, c := range chunks {
		fullContent += c.Content
		if c.Done && i == len(chunks)-1 {
			gotFinalDone = true
		}
	}

	if !strings.Contains(fullContent, "Let me run that...") {
		t.Error("expected initial thinking text from first round")
	}
	if !strings.Contains(fullContent, "The result is:") {
		t.Error("expected result text from second round")
	}
	if !strings.Contains(fullContent, "hello") {
		t.Error("expected tool output in final content")
	}
	if !gotFinalDone {
		t.Error("expected final chunk with done=true")
	}
}

func TestStreamOllamaChatNoTools(t *testing.T) {
	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/x-ndjson")
		writeNDJSON(w, []ollamaChatResponse{
			{Message: ollamaMessage{Content: "Hello"}, Done: false},
			{Message: ollamaMessage{Content: " world"}, Done: false},
			{Message: ollamaMessage{Content: ""}, Done: true},
		})
	}))
	defer mock.Close()

	originalURL := OllamaBaseURL
	OllamaBaseURL = mock.URL
	defer func() { OllamaBaseURL = originalURL }()

	rec := httptest.NewRecorder()
	err := StreamOllamaChat(rec, ChatRequest{
		Model:    "test-model",
		Messages: []Message{{Role: "user", Content: "hi"}},
	})
	if err != nil {
		t.Fatal(err)
	}

	lines := strings.Split(strings.TrimSpace(rec.Body.String()), "\n")
	if len(lines) < 2 {
		t.Fatalf("expected at least 2 output lines, got %d", len(lines))
	}

	var chunks []chatChunk
	for _, line := range lines {
		var c chatChunk
		if err := json.Unmarshal([]byte(line), &c); err != nil {
			t.Fatal(err)
		}
		chunks = append(chunks, c)
	}

	var combined string
	for i, c := range chunks {
		combined += c.Content
		if i == len(chunks)-1 && !c.Done {
			t.Error("expected final done=true")
		}
	}

	if combined != "Hello world" {
		t.Errorf("expected 'Hello world', got %q", combined)
	}
}

func TestStreamOllamaChatOllamaServerError(t *testing.T) {
	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "internal error", http.StatusInternalServerError)
	}))
	defer mock.Close()

	originalURL := OllamaBaseURL
	OllamaBaseURL = mock.URL
	defer func() { OllamaBaseURL = originalURL }()

	rec := httptest.NewRecorder()
	err := StreamOllamaChat(rec, ChatRequest{
		Model:    "test-model",
		Messages: []Message{{Role: "user", Content: "hi"}},
	})
	if err != nil {
		t.Fatal(err)
	}

	lines := strings.Split(strings.TrimSpace(rec.Body.String()), "\n")
	if len(lines) != 1 {
		t.Fatalf("expected 1 error chunk, got %d", len(lines))
	}

	var c chatChunk
	if err := json.Unmarshal([]byte(lines[0]), &c); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(c.Content, "Error") {
		t.Errorf("expected error content, got %q", c.Content)
	}
	if !c.Done {
		t.Error("expected done=true for error chunk")
	}
}

func TestStreamOllamaChatMultipleToolCalls(t *testing.T) {
	var callCount int

	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++
		body, _ := io.ReadAll(r.Body)
		var req ollamaRequest
		json.Unmarshal(body, &req)
		w.Header().Set("Content-Type", "application/x-ndjson")

		if callCount == 1 {
			args1, _ := json.Marshal(toolArgs{Command: "echo first"})
			args2, _ := json.Marshal(toolArgs{Command: "echo second"})
			writeNDJSON(w, []ollamaChatResponse{
				{
					Message: ollamaMessage{
						ToolCalls: []ToolCall{
							{ID: "c1", Function: ToolCallFunction{Index: 0, Name: "run_command", Arguments: args1}},
							{ID: "c2", Function: ToolCallFunction{Index: 1, Name: "run_command", Arguments: args2}},
						},
					},
					Done: true,
				},
			})
			return
		}

		if callCount == 2 {
			var toolCount int
			for _, m := range req.Messages {
				if m.Role == "tool" {
					toolCount++
				}
			}
			if toolCount != 2 {
				t.Errorf("expected 2 tool result messages, got %d", toolCount)
			}

			writeNDJSON(w, []ollamaChatResponse{
				{Message: ollamaMessage{Content: "Both done"}, Done: false},
				{Message: ollamaMessage{Content: ""}, Done: true},
			})
			return
		}

		t.Errorf("unexpected call #%d", callCount)
	}))
	defer mock.Close()

	originalURL := OllamaBaseURL
	OllamaBaseURL = mock.URL
	defer func() { OllamaBaseURL = originalURL }()

	rec := httptest.NewRecorder()
	err := StreamOllamaChat(rec, ChatRequest{
		Model:    "test-model",
		Messages: []Message{{Role: "user", Content: "run two commands"}},
	})
	if err != nil {
		t.Fatal(err)
	}

	if callCount != 2 {
		t.Errorf("expected 2 calls, got %d", callCount)
	}

	body := rec.Body.String()
	if !strings.Contains(body, "Both done") {
		t.Error("expected final content in output")
	}
	if !strings.Contains(body, "\"done\":true") {
		t.Error("expected final done chunk")
	}
}

func TestStreamOllamaChatToolFallback(t *testing.T) {
	var callCount int

	mock := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		callCount++

		if callCount == 1 {
			http.Error(w, "does not support tools", http.StatusBadRequest)
			return
		}

		w.Header().Set("Content-Type", "application/x-ndjson")
		writeNDJSON(w, []ollamaChatResponse{
			{Message: ollamaMessage{Content: "Hello without tools"}, Done: false},
			{Message: ollamaMessage{Content: ""}, Done: true},
		})
	}))
	defer mock.Close()

	originalURL := OllamaBaseURL
	OllamaBaseURL = mock.URL
	defer func() { OllamaBaseURL = originalURL }()

	rec := httptest.NewRecorder()
	err := StreamOllamaChat(rec, ChatRequest{
		Model:    "test-model",
		Messages: []Message{{Role: "user", Content: "hi"}},
	})
	if err != nil {
		t.Fatal(err)
	}

	if callCount != 2 {
		t.Errorf("expected 2 calls (1 with tools + fallback), got %d", callCount)
	}

	body := rec.Body.String()
	if !strings.Contains(body, "Hello without tools") {
		t.Errorf("expected fallback content, got %q", body)
	}
	if !strings.Contains(body, "\"done\":true") {
		t.Error("expected final done chunk")
	}
}
