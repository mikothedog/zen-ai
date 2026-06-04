package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"syscall"
	"time"

	"github.com/webview/webview_go"
)

//go:embed static
var staticFiles embed.FS

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/models", handleModels)
	mux.HandleFunc("/api/chat", handleChat)
	mux.HandleFunc("/api/shutdown", handleShutdown)

	staticFS, _ := fs.Sub(staticFiles, "static")
	mux.Handle("/", http.FileServer(http.FS(staticFS)))

	ln, err := net.Listen("tcp", ":"+defaultPort)
	if err != nil {
		log.Fatal("zen-ai is already running")
	}

	srv := &http.Server{
		Addr:    ":" + defaultPort,
		Handler: mux,
	}

	go func() {
		if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	go handleSignals(srv)

	time.Sleep(serverStartDelay)

	args := os.Args[1:]
	model := ""
	query := ""
	if len(args) > 0 && args[0] == "--model" {
		if len(args) < 2 {
			log.Fatal("--model requires a model name")
		}
		model = args[1]
		args = args[2:]
	}
	query = strings.Join(args, " ")

	target := "http://localhost:" + defaultPort
	params := url.Values{}
	if model != "" {
		params.Set("model", model)
	}
	if query != "" {
		params.Set("q", query)
	}
	if len(params) > 0 {
		target += "/?" + params.Encode()
	}

	w := webview.New(false)
	w.SetTitle("zen-ai")
	w.SetSize(webviewWidth, webviewHeight, webview.HintNone)
	w.Bind("openURL", func(url string) {
		exec.Command("xdg-open", url).Start()
	})
	w.Navigate(target)
	w.Run()
	w.Destroy()

	gracefulShutdown(srv)
}

func handleSignals(srv *http.Server) {
	sigint := make(chan os.Signal, 1)
	signal.Notify(sigint, os.Interrupt, syscall.SIGTERM)
	<-sigint
	gracefulShutdown(srv)
	os.Exit(0)
}

func gracefulShutdown(srv *http.Server) {
	log.Println("Shutting down...")
	unloadOllamaModel(activeModel)
	ctx, cancel := context.WithTimeout(context.Background(), serverShutdownWait)
	defer cancel()
	srv.Shutdown(ctx)
}
