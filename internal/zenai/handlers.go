package zenai

import (
	"encoding/json"
	"net/http"
)

var ActiveModel string

func HandleModels(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	models, err := FetchOllamaModels()
	if err != nil {
		http.Error(w, "failed to reach Ollama", http.StatusInternalServerError)
		return
	}

	if models == nil {
		models = []Model{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(models)
}

func HandleChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var chatReq ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&chatReq); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	ActiveModel = chatReq.Model

	enrichWithSearchResults(&chatReq)

	if err := StreamOllamaChat(w, chatReq); err != nil {
		http.Error(w, "failed to reach Ollama", http.StatusInternalServerError)
	}
}

func HandleShutdown(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("ok"))
	UnloadOllamaModel(ActiveModel)
}
