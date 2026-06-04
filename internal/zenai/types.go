package zenai

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

type ollamaModel struct {
	Name string `json:"name"`
}

type ollamaTagsResponse struct {
	Models []ollamaModel `json:"models"`
}

type ollamaMessage struct {
	Content string `json:"content"`
}

type ollamaChatResponse struct {
	Message ollamaMessage `json:"message"`
	Done    bool          `json:"done"`
}

type chatChunk struct {
	Content string `json:"content"`
	Done    bool   `json:"done"`
}

type ollamaRequest struct {
	Model    string    `json:"model"`
	Messages []Message `json:"messages"`
	Stream   bool      `json:"stream"`
}

type ollamaUnloadRequest struct {
	Model     string `json:"model"`
	KeepAlive int    `json:"keep_alive"`
}
