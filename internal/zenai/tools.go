package zenai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"strings"
	"time"
)

func GetTools() []Tool {
	return []Tool{
		{
			Function: ToolFunction{
				Name:        "web_search",
				Description: "Search the web for current information. Use this when you need up-to-date facts, news, or information you're not confident about.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"query": map[string]interface{}{
							"type":        "string",
							"description": "The search query",
						},
					},
					"required": []string{"query"},
				},
			},
		},
		{
			Function: ToolFunction{
				Name:        "read_file",
				Description: "Read the contents of a text file on the user's computer. Use this to examine code, configuration, logs, or any text file.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"path": map[string]interface{}{
							"type":        "string",
							"description": "Absolute path to the file",
						},
					},
					"required": []string{"path"},
				},
			},
		},
		{
			Function: ToolFunction{
				Name:        "run_command",
				Description: "Run a shell command on the user's computer. Use this to execute terminal commands, run scripts, compile code, check system info, or any task that requires the shell.",
				Parameters: map[string]interface{}{
					"type": "object",
					"properties": map[string]interface{}{
						"command": map[string]interface{}{
							"type":        "string",
							"description": "The shell command to execute",
						},
					},
					"required": []string{"command"},
				},
			},
		},
	}
}

type toolArgs struct {
	Query   string `json:"query"`
	Path    string `json:"path"`
	Command string `json:"command"`
}

func ExecuteTool(name string, args json.RawMessage) (string, error) {
	switch name {
	case "web_search":
		var a toolArgs
		if err := json.Unmarshal(args, &a); err != nil {
			return "", fmt.Errorf("invalid arguments: %w", err)
		}
		return SearchDuckDuckGo(a.Query)

	case "read_file":
		var a toolArgs
		if err := json.Unmarshal(args, &a); err != nil {
			return "", fmt.Errorf("invalid arguments: %w", err)
		}
		return ReadFileContent(a.Path)

	case "run_command":
		var a toolArgs
		if err := json.Unmarshal(args, &a); err != nil {
			return "", fmt.Errorf("invalid arguments: %w", err)
		}
		return RunCommand(a.Command)

	default:
		return "", fmt.Errorf("unknown tool: %s", name)
	}
}

const (
	cmdTimeout   = 30 * time.Second
	cmdMaxOutput = 50 * 1024
	maxFileSize  = 1 * 1024 * 1024
)

func RunCommand(command string) (string, error) {
	command = strings.TrimSpace(command)
	if command == "" {
		return "", fmt.Errorf("command is empty")
	}

	ctx, cancel := context.WithTimeout(context.Background(), cmdTimeout)
	defer cancel()

	cmd := exec.CommandContext(ctx, "sh", "-c", command)
	var stdout, stderr bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = &stderr

	err := cmd.Run()

	out := stdout.String()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return out, fmt.Errorf("command timed out after %v", cmdTimeout)
		}
		if stderr.Len() > 0 {
			out += "\nstderr:\n" + stderr.String()
		}
		return out, fmt.Errorf("exit error: %v", err)
	}

	if stderr.Len() > 0 {
		out += "\nstderr:\n" + stderr.String()
	}

	if len(out) > cmdMaxOutput {
		out = out[:cmdMaxOutput] + "\n... (output truncated)"
	}

	return out, nil
}

func ReadFileContent(path string) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		return "", fmt.Errorf("path is empty")
	}

	info, err := os.Stat(path)
	if err != nil {
		return "", fmt.Errorf("cannot access file: %w", err)
	}

	if info.IsDir() {
		return "", fmt.Errorf("path is a directory, not a file")
	}

	if info.Size() > maxFileSize {
		return "", fmt.Errorf("file too large (%d bytes, max %d)", info.Size(), maxFileSize)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return "", fmt.Errorf("cannot read file: %w", err)
	}

	if bytes.Contains(data, []byte{0}) {
		return "", fmt.Errorf("file appears to be binary (contains null bytes)")
	}

	return string(data), nil
}
