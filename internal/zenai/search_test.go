package zenai

import (
	"fmt"
	"strings"
	"testing"
)

const sampleHTML = `<html><body>
<div class="result">
  <a class="result__a" href="https://example.com/1">Result One Title</a>
  <a class="result__snippet" href="https://example.com/1">First result snippet text here</a>
</div>
<div class="result">
  <a class="result__a" href="https://example.com/2">Second Result</a>
  <a class="result__snippet" href="https://example.com/2">Another snippet with info</a>
</div>
</body></html>`

func TestFormatResults(t *testing.T) {
	result := formatResults("test query", sampleHTML)

	if !strings.Contains(result, "test query") {
		t.Error("missing query")
	}
	if !strings.Contains(result, "Result One Title") {
		t.Error("missing first title")
	}
	if !strings.Contains(result, "Second Result") {
		t.Error("missing second title")
	}
	if !strings.Contains(result, "First result snippet") {
		t.Error("missing first snippet")
	}
	if !strings.Contains(result, "https://example.com/1") {
		t.Error("missing URL")
	}
}

func TestFormatResultsNoResults(t *testing.T) {
	result := formatResults("nothing", "<html><body>no results</body></html>")
	if result != "" {
		t.Error("expected empty for no results")
	}
}

func TestFormatResultsCaptcha(t *testing.T) {
	result := formatResults("blocked", `<html><body class="anomaly-modal__mask">captcha</body></html>`)
	if result != "" {
		t.Error("expected empty for captcha page")
	}
}

func TestFormatResultsMaxFive(t *testing.T) {
	var html strings.Builder
	html.WriteString("<html><body>")
	for i := range 10 {
		html.WriteString(fmt.Sprintf(
			`<div class="result"><a class="result__a" href="https://x.com/%d">Result %d</a><a class="result__snippet" href="https://x.com/%d">Snippet %d</a></div>`,
			i, i, i, i,
		))
	}
	html.WriteString("</body></html>")

	result := formatResults("many", html.String())
	lines := strings.Split(result, "\n")
	count := 0
	for _, line := range lines {
		if strings.HasPrefix(line, "   URL:") {
			count++
		}
	}
	if count != 5 {
		t.Errorf("expected 5 results, got %d", count)
	}
}

func TestCleanHTML(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"<b>bold</b> text", "bold text"},
		{"hello &amp; world", "hello & world"},
		{"spaces   here", "spaces here"},
		{"  trimmed  ", "trimmed"},
	}
	for _, tc := range tests {
		got := cleanHTML(tc.input)
		if got != tc.want {
			t.Errorf("cleanHTML(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}

func TestCleanURL(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"https://example.com", "https://example.com"},
		{"//example.com", "https://example.com"},
		{"https://example.com%20path", "https://example.com path"},
	}
	for _, tc := range tests {
		got := cleanURL(tc.input)
		if got != tc.want {
			t.Errorf("cleanURL(%q) = %q, want %q", tc.input, got, tc.want)
		}
	}
}

func TestShouldSearch(t *testing.T) {
	tests := []struct {
		msg  string
		want bool
	}{
		{"!What is the capital of France?", true},
		{"!who won the latest election?", true},
		{"!how does photosynthesis work?", true},
		{"!weather in Tokyo", true},
		{"!current president of france", true},
		{"What is the capital of France?", false},
		{"who won the election?", false},
		{"hello", false},
		{"!", true},
		{"! ", true},
	}
	for _, tc := range tests {
		got := shouldSearch(tc.msg)
		if got != tc.want {
			t.Errorf("shouldSearch(%q) = %v, want %v", tc.msg, got, tc.want)
		}
	}
}

func TestLiveSearchGeneric(t *testing.T) {
	if testing.Short() {
		t.Skip("skipping live search")
	}
	result, err := SearchDuckDuckGo("current president of france")
	if err != nil {
		t.Fatal(err)
	}
	t.Logf("Search (%d chars):\n%s", len(result), result)
	if len(result) < 50 {
		t.Fatal("too short, DDG might have blocked")
	}
}
