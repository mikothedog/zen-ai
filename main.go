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

	query := strings.Join(os.Args[1:], " ")
	target := "http://localhost:" + defaultPort
	if query != "" {
		target += "/?q=" + url.QueryEscape(query)
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
