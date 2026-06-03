package main

import "time"

const (
	defaultPort        = "8765"
	ollamaBaseURL      = "http://localhost:11434"
	excludeModelTag    = ":cloud"
	serverShutdownWait = 3 * time.Second
	serverStartDelay   = 30 * time.Millisecond
	webviewWidth       = 900
	webviewHeight      = 700
)
