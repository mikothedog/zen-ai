package main

import (
	"embed"
	"io/fs"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"
	"os/exec"
	"strings"
	"time"

	"zen-ai/internal/zenai"

	"github.com/webview/webview_go"
)

//go:embed static
var staticFiles embed.FS

const (
	webviewWidth  = 900
	webviewHeight = 700
)

func main() {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/models", zenai.HandleModels)
	mux.HandleFunc("/api/chat", zenai.HandleChat)
	mux.HandleFunc("/api/shutdown", zenai.HandleShutdown)

	staticFS, _ := fs.Sub(staticFiles, "static")
	mux.Handle("/", http.FileServer(http.FS(staticFS)))

	ln, err := net.Listen("tcp", ":"+zenai.DefaultPort)
	if err != nil {
		log.Fatal("zen-ai is already running")
	}

	srv := &http.Server{
		Addr:    ":" + zenai.DefaultPort,
		Handler: mux,
	}

	go func() {
		if err := srv.Serve(ln); err != nil && err != http.ErrServerClosed {
			log.Fatal(err)
		}
	}()

	go zenai.HandleSignals(srv)

	time.Sleep(zenai.ServerStartDelay)

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

	target := "http://localhost:" + zenai.DefaultPort
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

	zenai.Shutdown(srv)
}
