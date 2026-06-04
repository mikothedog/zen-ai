package zenai

import "time"

const (
	DefaultPort        = "8765"
	OllamaBaseURL      = "http://localhost:11434"
	ExcludeModelTag    = ":cloud"
	ServerShutdownWait = 3 * time.Second
	ServerStartDelay   = 30 * time.Millisecond
)
