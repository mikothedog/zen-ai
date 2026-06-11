package zenai

import (
	"context"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
)

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
