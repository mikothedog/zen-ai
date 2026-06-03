# 🧘 zen-ai

Lightweight local AI chat app with a WebView GUI, Rofi launcher, and optional web search.

Powered by [Ollama](https://ollama.ai).

## ✨ Features

- **Minimal WebView UI** — no browser tabs, no bloat
- **Streaming responses** — real-time token-by-token output
- **Math rendering** — LaTeX via KaTeX (`\[ ... \]` / `\( ... \)`)
- **Web search** — prefix any message with `!` to pull DuckDuckGo results
- **Copy buttons** — hover on code blocks or messages to copy
- **Model picker** — dropdown to switch Ollama models
- **Keyboard shortcuts** — `Ctrl+L` focus input, `Ctrl+J`/`Ctrl+K` scroll, `Ctrl+G` bottom
- **Rofi launcher** — quick prompt from anywhere

## 🚀 Quick start

```sh
./install.sh
```

Or manually:

```sh
go build -mod=vendor -o zen-ai .
sudo cp zen-ai /usr/local/bin/
```

Requires: `go`, `webkit2gtk-4.1`, `ollama` running on `localhost:11434`.

## ⌨️ Usage

```sh
zen-ai                        # open empty chat
zen-ai "what is the meaning of life?"  # open with initial prompt
```

## 🔍 Web search

Start a message with `!` to search the web:

```
!what is the capital of France
!weather in Tokyo
!latest AI news
```

The model receives search results as context and answers based on them.

> **Note:** Web search queries DuckDuckGo's public HTML results page. This is a personal-use, rate-limited client. Not affiliated with DuckDuckGo.

## 🎨 Theme

Built with [Rosé Pine Moon](https://rosepinetheme.com) colors.

## 📁 Project structure

```
main.go          # entry point, WebView, signals
config.go        # constants
types.go         # shared types
handlers.go      # HTTP handlers
ollama.go        # Ollama API client
search.go        # DuckDuckGo search
search_test.go   # search tests
static/          # frontend (app.js, style.css, index.html)
static/katex/    # KaTeX for LaTeX rendering
install.sh       # install script
launch.sh        # Rofi launcher
```

## 🧪 Tests

```sh
go test -mod=vendor -short ./...
npm install --dev && node --test static/app.test.js
```
