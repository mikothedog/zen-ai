package main

import (
	"context"
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"strings"
	"syscall"
	"time"
)

//go:embed static
var staticFiles embed.FS

const ollamaURL = "http://localhost:11434"

type Model struct {
	Name string `json:"name"`
}

type ChatRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
}

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

func main() {
	port := "8765"
	if len(os.Args) > 1 {
		port = os.Args[1]
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/api/models", handleModels)
	mux.HandleFunc("/api/chat", handleChat)
	mux.HandleFunc("/api/shutdown", handleShutdown)

	staticFS, _ := fs.Sub(staticFiles, "static")
	mux.Handle("/", http.FileServer(http.FS(staticFS)))

	srv := &http.Server{
		Addr:    ":" + port,
		Handler: mux,
	}

	go func() {
		sigint := make(chan os.Signal, 1)
		signal.Notify(sigint, os.Interrupt, syscall.SIGTERM)
		<-sigint
		log.Println("Shutting down...")
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		srv.Shutdown(ctx)
	}()

	log.Printf("zen-ai listening on http://localhost:%s", port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}

var lastModel string

func unloadModel(model string) {
	if model == "" {
		return
	}
	body, _ := json.Marshal(map[string]interface{}{
		"model":      model,
		"keep_alive": 0,
	})
	http.Post(ollamaURL+"/api/generate", "application/json", strings.NewReader(string(body)))
}

func handleShutdown(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	w.Write([]byte("ok"))
	go func() {
		time.Sleep(100 * time.Millisecond)
		unloadModel(lastModel)
		p, _ := os.FindProcess(os.Getpid())
		p.Signal(os.Interrupt)
	}()
}

func handleModels(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	resp, err := http.Get(ollamaURL + "/api/tags")
	if err != nil {
		http.Error(w, "failed to reach Ollama", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	var result struct {
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		http.Error(w, "failed to decode Ollama response", http.StatusInternalServerError)
		return
	}

	localModels := make([]Model, 0)
	for _, m := range result.Models {
		if !strings.Contains(m.Name, ":cloud") {
			localModels = append(localModels, Model{Name: m.Name})
		}
	}

	if localModels == nil {
		localModels = []Model{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(localModels)
}

func handleChat(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var chatReq ChatRequest
	if err := json.NewDecoder(r.Body).Decode(&chatReq); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	lastModel = chatReq.Model

	ollamaBody, _ := json.Marshal(map[string]interface{}{
		"model":    chatReq.Model,
		"messages": chatReq.Messages,
		"stream":   true,
	})

	resp, err := http.Post(ollamaURL+"/api/chat", "application/json", strings.NewReader(string(ollamaBody)))
	if err != nil {
		http.Error(w, "failed to reach Ollama", http.StatusInternalServerError)
		return
	}
	defer resp.Body.Close()

	w.Header().Set("Content-Type", "application/x-ndjson")
	w.WriteHeader(http.StatusOK)

	flusher, ok := w.(http.Flusher)
	if !ok {
		http.Error(w, "streaming not supported", http.StatusInternalServerError)
		return
	}

	decoder := json.NewDecoder(resp.Body)
	for {
		var ollamaResp struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
			Done bool `json:"done"`
		}

		if err := decoder.Decode(&ollamaResp); err != nil {
			if err == io.EOF {
				break
			}
			break
		}

		chunk := struct {
			Content string `json:"content"`
			Done    bool   `json:"done"`
		}{
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
}
