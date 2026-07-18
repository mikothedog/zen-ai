package zenai

import (
	"encoding/json"
	"strings"
	"testing"
)

func TestToolJSON(t *testing.T) {
	tool := Tool{
		Function: ToolFunction{
			Name:        "test_tool",
			Description: "A test tool",
			Parameters: map[string]interface{}{
				"type": "object",
				"properties": map[string]interface{}{
					"input": map[string]interface{}{
						"type": "string",
					},
				},
				"required": []string{"input"},
			},
		},
	}

	data, err := json.Marshal(tool)
	if err != nil {
		t.Fatal(err)
	}

	if !strings.Contains(string(data), "test_tool") {
		t.Error("expected marshaled JSON to contain tool name")
	}
	if !strings.Contains(string(data), "\"type\":\"object\"") {
		t.Error("expected marshaled JSON to contain parameters type")
	}
	if !strings.Contains(string(data), "\"required\"") {
		t.Error("expected marshaled JSON to contain required field")
	}

	var decoded Tool
	if err := json.Unmarshal(data, &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.Function.Name != "test_tool" {
		t.Errorf("decoded name = %q, want %q", decoded.Function.Name, "test_tool")
	}
}

func TestToolCallJSON(t *testing.T) {
	tc := ToolCall{
		ID: "call_abc123",
		Function: ToolCallFunction{
			Index:     0,
			Name:      "my_tool",
			Arguments: json.RawMessage(`{"key":"value"}`),
		},
	}

	data, err := json.Marshal(tc)
	if err != nil {
		t.Fatal(err)
	}

	s := string(data)
	if !strings.Contains(s, "call_abc123") {
		t.Error("expected id field")
	}
	if !strings.Contains(s, "\"index\":0") {
		t.Error("expected index field")
	}
	if !strings.Contains(s, "my_tool") {
		t.Error("expected function name")
	}
	if !strings.Contains(s, "\"key\":\"value\"") {
		t.Error("expected arguments")
	}

	raw := `{"id":"call_xyz","function":{"index":1,"name":"read_file","arguments":{"path":"/tmp/f"}}}`
	var decoded ToolCall
	if err := json.Unmarshal([]byte(raw), &decoded); err != nil {
		t.Fatal(err)
	}
	if decoded.ID != "call_xyz" {
		t.Errorf("id = %q, want %q", decoded.ID, "call_xyz")
	}
	if decoded.Function.Index != 1 {
		t.Errorf("index = %d, want 1", decoded.Function.Index)
	}
	if decoded.Function.Name != "read_file" {
		t.Errorf("name = %q, want %q", decoded.Function.Name, "read_file")
	}
	expectedArgs := `{"path":"/tmp/f"}`
	if string(decoded.Function.Arguments) != expectedArgs {
		t.Errorf("arguments = %q, want %q", string(decoded.Function.Arguments), expectedArgs)
	}
}

func TestMessageJSON(t *testing.T) {
	t.Run("user message", func(t *testing.T) {
		msg := Message{Role: "user", Content: "hello"}
		data, _ := json.Marshal(msg)
		s := string(data)
		if !strings.Contains(s, "\"role\":\"user\"") {
			t.Error("expected role")
		}
		if !strings.Contains(s, "\"content\":\"hello\"") {
			t.Error("expected content")
		}
		if strings.Contains(s, "tool_calls") {
			t.Error("user message should not have tool_calls")
		}
	})

	t.Run("assistant message with content", func(t *testing.T) {
		msg := Message{Role: "assistant", Content: "hi"}
		data, _ := json.Marshal(msg)
		s := string(data)
		if !strings.Contains(s, "\"content\":\"hi\"") {
			t.Error("expected content")
		}
	})

	t.Run("assistant message with tool_calls", func(t *testing.T) {
		msg := Message{
			Role: "assistant",
			ToolCalls: []ToolCall{
				{ID: "call_1", Function: ToolCallFunction{Name: "test", Arguments: json.RawMessage(`{}`)}},
			},
		}
		data, _ := json.Marshal(msg)
		s := string(data)
		if strings.Contains(s, "\"content\"") {
			t.Error("content should be omitted when empty")
		}
		if !strings.Contains(s, "tool_calls") {
			t.Error("expected tool_calls")
		}
		if !strings.Contains(s, "call_1") {
			t.Error("expected tool call id")
		}
		if !strings.Contains(s, "\"name\":\"test\"") {
			t.Error("expected function name")
		}
	})

	t.Run("tool message", func(t *testing.T) {
		msg := Message{Role: "tool", Content: "result data"}
		data, _ := json.Marshal(msg)
		s := string(data)
		if !strings.Contains(s, "\"role\":\"tool\"") {
			t.Error("expected tool role")
		}
		if !strings.Contains(s, "\"content\":\"result data\"") {
			t.Error("expected content")
		}
	})
}

func TestOllamaRequestJSON(t *testing.T) {
	t.Run("without tools", func(t *testing.T) {
		req := ollamaRequest{
			Model:    "test-model",
			Messages: []Message{{Role: "user", Content: "hi"}},
			Stream:   true,
		}
		data, _ := json.Marshal(req)
		s := string(data)
		if !strings.Contains(s, "test-model") {
			t.Error("expected model")
		}
		if strings.Contains(s, "tools") {
			t.Error("tools should be omitted when empty")
		}
	})

	t.Run("with tools", func(t *testing.T) {
		req := ollamaRequest{
			Model:    "test-model",
			Messages: []Message{{Role: "user", Content: "hi"}},
			Stream:   true,
			Tools:    []Tool{{Function: ToolFunction{Name: "web_search"}}},
		}
		data, _ := json.Marshal(req)
		s := string(data)
		if !strings.Contains(s, "tools") {
			t.Error("expected tools field")
		}
		if !strings.Contains(s, "web_search") {
			t.Error("expected tool name")
		}
	})
}

func TestOllamaChatResponseJSON(t *testing.T) {
	t.Run("with tool_calls", func(t *testing.T) {
		raw := `{"message":{"role":"assistant","content":"","tool_calls":[{"id":"call_1","function":{"index":0,"name":"test","arguments":"{\"x\":1}"}}]},"done":true}`
		var resp ollamaChatResponse
		if err := json.Unmarshal([]byte(raw), &resp); err != nil {
			t.Fatal(err)
		}
		if !resp.Done {
			t.Error("expected done=true")
		}
		if len(resp.Message.ToolCalls) != 1 {
			t.Fatalf("expected 1 tool call, got %d", len(resp.Message.ToolCalls))
		}
		if resp.Message.ToolCalls[0].ID != "call_1" {
			t.Errorf("id = %q", resp.Message.ToolCalls[0].ID)
		}
		if resp.Message.ToolCalls[0].Function.Name != "test" {
			t.Errorf("name = %q", resp.Message.ToolCalls[0].Function.Name)
		}
	})

	t.Run("without tool_calls", func(t *testing.T) {
		raw := `{"message":{"role":"assistant","content":"hello"},"done":true}`
		var resp ollamaChatResponse
		if err := json.Unmarshal([]byte(raw), &resp); err != nil {
			t.Fatal(err)
		}
		if resp.Message.Content != "hello" {
			t.Errorf("content = %q", resp.Message.Content)
		}
		if resp.Message.ToolCalls != nil {
			t.Error("expected nil tool_calls")
		}
	})
}

func TestChatChunkJSON(t *testing.T) {
	chunk := chatChunk{Content: "hello", Done: false}
	data, _ := json.Marshal(chunk)
	s := string(data)
	if !strings.Contains(s, "\"content\":\"hello\"") {
		t.Error("expected content")
	}
	if !strings.Contains(s, "\"done\":false") {
		t.Error("expected done: false")
	}
}
