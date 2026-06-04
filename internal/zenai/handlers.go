package zenai

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
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

func enrichWithSearchResults(req *ChatRequest) {
	lastMsg := getLastUserMessage(req.Messages)
	if !shouldSearch(lastMsg) {
		return
	}

	query := strings.TrimPrefix(strings.TrimSpace(lastMsg), "!")

	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role == "user" {
			req.Messages[i].Content = query
			break
		}
	}

	results, err := SearchDuckDuckGo(query)
	if err != nil || results == "" {
		return
	}

	for i := len(req.Messages) - 1; i >= 0; i-- {
		if req.Messages[i].Role == "user" {
			req.Messages[i].Content = "Web search results:\n" + results + "\n\nUser question (use the search results above to answer):\n" + query
			break
		}
	}
}

func Shutdown(srv *http.Server) {
	log.Println("Shutting down...")
	UnloadOllamaModel(ActiveModel)
	ctx, cancel := context.WithTimeout(context.Background(), ServerShutdownWait)
	defer cancel()
	srv.Shutdown(ctx)
}

func HandleSignals(srv *http.Server) {
	sigint := make(chan os.Signal, 1)
	signal.Notify(sigint, os.Interrupt, syscall.SIGTERM)
	<-sigint
	Shutdown(srv)
	os.Exit(0)
}
