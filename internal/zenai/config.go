package zenai

import "time"

var OllamaBaseURL = "http://localhost:11434"

const (
	DefaultPort        = "8765"
	ExcludeModelTag    = ":cloud"
	ServerShutdownWait = 3 * time.Second
	ServerStartDelay   = 30 * time.Millisecond
)
