package zenai

import "strings"

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
