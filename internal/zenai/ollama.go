package zenai

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

func FetchOllamaModels() ([]Model, error) {
	resp, err := http.Get(OllamaBaseURL + "/api/tags")
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var result ollamaTagsResponse
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return nil, err
	}

	var models []Model
	for _, m := range result.Models {
		if !strings.Contains(m.Name, ExcludeModelTag) {
			models = append(models, Model{Name: m.Name})
		}
	}
	return models, nil
}

func StreamOllamaChat(w http.ResponseWriter, req ChatRequest) error {
	messages := req.Messages
	tools := GetTools()

	w.Header().Set("Content-Type", "application/x-ndjson")
	w.WriteHeader(http.StatusOK)

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return nil
	}

	for {
		body, _ := json.Marshal(ollamaRequest{
			Model:    req.Model,
			Messages: messages,
			Stream:   true,
			Tools:    tools,
		})

		resp, err := http.Post(OllamaBaseURL+"/api/chat", "application/json", strings.NewReader(string(body)))
		if err != nil {
			chunk := chatChunk{Content: "Error: " + err.Error(), Done: true}
			data, _ := json.Marshal(chunk)
			fmt.Fprintln(w, string(data))
			flusher.Flush()
			return nil
		}

		if resp.StatusCode != http.StatusOK && len(tools) > 0 {
			resp.Body.Close()
			tools = nil
			continue
		}

		if resp.StatusCode != http.StatusOK {
			resp.Body.Close()
			chunk := chatChunk{Content: "Error: Ollama returned status " + resp.Status, Done: true}
			data, _ := json.Marshal(chunk)
			fmt.Fprintln(w, string(data))
			flusher.Flush()
			return nil
		}

		decoder := json.NewDecoder(resp.Body)
		var toolCalls []ToolCall

		for {
			var ollamaResp ollamaChatResponse
			if err := decoder.Decode(&ollamaResp); err != nil {
				if err == io.EOF {
					break
				}
				break
			}

			if ollamaResp.Message.ToolCalls != nil {
				toolCalls = ollamaResp.Message.ToolCalls
			}

			chunk := chatChunk{
				Content: ollamaResp.Message.Content,
				Done:    false,
			}
			data, _ := json.Marshal(chunk)
			fmt.Fprintln(w, string(data))
			flusher.Flush()

			if ollamaResp.Done {
				break
			}
		}
		resp.Body.Close()

		if len(toolCalls) == 0 {
			finalChunk := chatChunk{Content: "", Done: true}
			data, _ := json.Marshal(finalChunk)
			fmt.Fprintln(w, string(data))
			flusher.Flush()
			return nil
		}

		messages = append(messages, Message{Role: "assistant", ToolCalls: toolCalls})

		for _, tc := range toolCalls {
			result, err := ExecuteTool(tc.Function.Name, tc.Function.Arguments)
			if err != nil {
				result = "Error: " + err.Error()
			}
			messages = append(messages, Message{Role: "tool", Content: result})
		}
	}
}

func UnloadOllamaModel(model string) {
	if model == "" {
		return
	}
	body, _ := json.Marshal(ollamaUnloadRequest{
		Model:     model,
		KeepAlive: 0,
	})
	http.Post(OllamaBaseURL+"/api/generate", "application/json", strings.NewReader(string(body)))
}
