package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
)

func fetchOllamaModels() ([]Model, error) {
	resp, err := http.Get(ollamaBaseURL + "/api/tags")
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
		if !strings.Contains(m.Name, excludeModelTag) {
			models = append(models, Model{Name: m.Name})
		}
	}
	return models, nil
}

func streamOllamaChat(w http.ResponseWriter, req ChatRequest) error {
	body, _ := json.Marshal(ollamaRequest{
		Model:    req.Model,
		Messages: req.Messages,
		Stream:   true,
	})

	resp, err := http.Post(ollamaBaseURL+"/api/chat", "application/json", strings.NewReader(string(body)))
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/x-ndjson")
	w.WriteHeader(http.StatusOK)

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return nil
	}

	decoder := json.NewDecoder(resp.Body)
	for {
		var ollamaResp ollamaChatResponse
		if err := decoder.Decode(&ollamaResp); err != nil {
			if err == io.EOF {
				break
			}
			break
		}

		chunk := chatChunk{
			Content: ollamaResp.Message.Content,
			Done:    ollamaResp.Done,
		}

		data, _ := json.Marshal(chunk)
		fmt.Fprintln(w, string(data))
		flusher.Flush()

		if ollamaResp.Done {
			break
		}
	}
	return nil
}

func unloadOllamaModel(model string) {
	if model == "" {
		return
	}
	body, _ := json.Marshal(ollamaUnloadRequest{
		Model:     model,
		KeepAlive: 0,
	})
	http.Post(ollamaBaseURL+"/api/generate", "application/json", strings.NewReader(string(body)))
}
