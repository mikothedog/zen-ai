package zenai

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestGetTools(t *testing.T) {
	tools := GetTools()

	if len(tools) != 3 {
		t.Fatalf("expected 3 tools, got %d", len(tools))
	}

	names := make([]string, len(tools))
	for i, tool := range tools {
		names[i] = tool.Function.Name
	}
	expected := []string{"web_search", "read_file", "run_command"}
	for i, name := range expected {
		if names[i] != name {
			t.Errorf("tool[%d].Function.Name = %q, want %q", i, names[i], name)
		}
	}

	for _, tool := range tools {
		params, ok := tool.Function.Parameters.(map[string]interface{})
		if !ok {
			t.Errorf("tool %q: Parameters not a map", tool.Function.Name)
			continue
		}
		if params["type"] != "object" {
			t.Errorf("tool %q: params.type = %v, want 'object'", tool.Function.Name, params["type"])
		}
		props, ok := params["properties"].(map[string]interface{})
		if !ok {
			t.Errorf("tool %q: params.properties not a map", tool.Function.Name)
			continue
		}
		requiredRaw := params["required"]
		if requiredRaw == nil {
			t.Errorf("tool %q: params.required is nil", tool.Function.Name)
			continue
		}
		var required []string
		switch v := requiredRaw.(type) {
		case []interface{}:
			for _, item := range v {
				s, _ := item.(string)
				required = append(required, s)
			}
		case []string:
			required = v
		default:
			t.Errorf("tool %q: params.required has unexpected type %T", tool.Function.Name, requiredRaw)
			continue
		}
		if len(required) != 1 {
			t.Errorf("tool %q: expected 1 required field, got %d", tool.Function.Name, len(required))
		}
		reqField := required[0]
		if _, ok := props[reqField]; !ok {
			t.Errorf("tool %q: required field %q missing from properties", tool.Function.Name, reqField)
		}
	}
}

func TestExecuteToolUnknown(t *testing.T) {
	_, err := ExecuteTool("nonexistent", nil)
	if err == nil || !strings.Contains(err.Error(), "unknown tool") {
		t.Errorf("expected 'unknown tool' error, got %v", err)
	}
}

func TestExecuteToolReadFileInvalidArgs(t *testing.T) {
	_, err := ExecuteTool("read_file", json.RawMessage(`invalid`))
	if err == nil || !strings.Contains(err.Error(), "invalid arguments") {
		t.Errorf("expected 'invalid arguments' error, got %v", err)
	}
}

func TestExecuteToolReadFile(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "test.txt")
	if err := os.WriteFile(path, []byte("hello world"), 0644); err != nil {
		t.Fatal(err)
	}

	args, _ := json.Marshal(toolArgs{Path: path})
	result, err := ExecuteTool("read_file", args)
	if err != nil {
		t.Fatal(err)
	}
	if result != "hello world" {
		t.Errorf("got %q, want %q", result, "hello world")
	}
}

func TestExecuteToolRunCommand(t *testing.T) {
	args, _ := json.Marshal(toolArgs{Command: "echo hello"})
	result, err := ExecuteTool("run_command", args)
	if err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(result) != "hello" {
		t.Errorf("expected 'hello', got %q", result)
	}
}

func TestExecuteToolRunCommandInvalidArgs(t *testing.T) {
	_, err := ExecuteTool("run_command", json.RawMessage(`not json`))
	if err == nil || !strings.Contains(err.Error(), "invalid arguments") {
		t.Errorf("expected 'invalid arguments' error, got %v", err)
	}
}

func TestReadFileContentEmptyPath(t *testing.T) {
	_, err := ReadFileContent("")
	if err == nil || !strings.Contains(err.Error(), "empty") {
		t.Errorf("expected 'empty' error, got %v", err)
	}
	_, err = ReadFileContent("   ")
	if err == nil || !strings.Contains(err.Error(), "empty") {
		t.Errorf("expected 'empty' error for whitespace path, got %v", err)
	}
}

func TestReadFileContentNotExist(t *testing.T) {
	_, err := ReadFileContent("/nonexistent/path/xyz123")
	if err == nil || !strings.Contains(err.Error(), "cannot access") {
		t.Errorf("expected 'cannot access' error, got %v", err)
	}
}

func TestReadFileContentIsDir(t *testing.T) {
	dir := t.TempDir()
	_, err := ReadFileContent(dir)
	if err == nil || !strings.Contains(err.Error(), "directory") {
		t.Errorf("expected 'directory' error, got %v", err)
	}
}

func TestReadFileContentSuccess(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "hello.txt")
	content := "hello\nworld\n"
	if err := os.WriteFile(path, []byte(content), 0644); err != nil {
		t.Fatal(err)
	}

	result, err := ReadFileContent(path)
	if err != nil {
		t.Fatal(err)
	}
	if result != content {
		t.Errorf("got %q, want %q", result, content)
	}
}

func TestReadFileContentBinary(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "binary.bin")
	if err := os.WriteFile(path, []byte{0, 1, 2}, 0644); err != nil {
		t.Fatal(err)
	}

	_, err := ReadFileContent(path)
	if err == nil || !strings.Contains(err.Error(), "binary") {
		t.Errorf("expected 'binary' error, got %v", err)
	}
}

func TestReadFileContentTooLarge(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "large.txt")
	data := make([]byte, maxFileSize+1)
	if err := os.WriteFile(path, data, 0644); err != nil {
		t.Fatal(err)
	}

	_, err := ReadFileContent(path)
	if err == nil || !strings.Contains(err.Error(), "too large") {
		t.Errorf("expected 'too large' error, got %v", err)
	}
}

func TestRunCommandEmpty(t *testing.T) {
	_, err := RunCommand("")
	if err == nil || !strings.Contains(err.Error(), "empty") {
		t.Errorf("expected 'empty' error, got %v", err)
	}
	_, err = RunCommand("   ")
	if err == nil || !strings.Contains(err.Error(), "empty") {
		t.Errorf("expected 'empty' error, got %v", err)
	}
}

func TestRunCommandSuccess(t *testing.T) {
	result, err := RunCommand("echo hello world")
	if err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(result) != "hello world" {
		t.Errorf("got %q, want 'hello world'", result)
	}
}

func TestRunCommandExitError(t *testing.T) {
	result, err := RunCommand("false")
	if err == nil || !strings.Contains(err.Error(), "exit error") {
		t.Errorf("expected 'exit error', got %v", err)
	}
	if result != "" {
		t.Errorf("expected empty stdout, got %q", result)
	}
}

func TestRunCommandWithStderr(t *testing.T) {
	result, err := RunCommand("echo out && echo err >&2")
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(result, "out") {
		t.Errorf("expected stdout 'out' in result, got %q", result)
	}
	if !strings.Contains(result, "err") {
		t.Errorf("expected stderr 'err' in result, got %q", result)
	}
}
