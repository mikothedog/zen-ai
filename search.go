package main

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"
)

var ddgClient = &http.Client{
	Timeout: 10 * time.Second,
	CheckRedirect: func(req *http.Request, via []*http.Request) error {
		if len(via) >= 3 {
			return fmt.Errorf("too many redirects")
		}
		req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0")
		return nil
	},
}

var (
	titleRe   = regexp.MustCompile(`<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>\s*(.*?)\s*</a>`)
	snippetRe = regexp.MustCompile(`<a[^>]*class="result__snippet"[^>]*>\s*(.*?)\s*</a>`)
	tagRe     = regexp.MustCompile(`<[^>]*>`)
	spaceRe   = regexp.MustCompile(`\s+`)
)

func SearchDuckDuckGo(query string) (string, error) {
	u := fmt.Sprintf("https://html.duckduckgo.com/html/?q=%s", url.QueryEscape(query))

	req, err := http.NewRequest("GET", u, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0")
	req.Header.Set("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8")
	req.Header.Set("Accept-Language", "en-US,en;q=0.5")
	req.Header.Set("Referer", "https://duckduckgo.com/")
	req.Header.Set("DNT", "1")

	resp, err := ddgClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	return formatResults(query, string(body)), nil
}

func formatResults(query, html string) string {
	// Check for CAPTCHA or bot detection
	if strings.Contains(html, "anomaly-modal") || strings.Contains(html, "captcha") {
		return ""
	}

	titles := titleRe.FindAllStringSubmatch(html, -1)
	snippets := snippetRe.FindAllStringSubmatch(html, -1)

	n := len(titles)
	if n > 5 {
		n = 5
	}
	if n == 0 {
		return ""
	}

	var b strings.Builder
	fmt.Fprintf(&b, "Web search results for \"%s\":\n\n", query)

	for i := 0; i < n; i++ {
		title := cleanHTML(titles[i][2])
		link := cleanURL(titles[i][1])
		snippet := ""
		if i < len(snippets) {
			snippet = cleanHTML(snippets[i][1])
		}
		fmt.Fprintf(&b, "%d. %s\n   URL: %s\n   %s\n\n", i+1, title, link, snippet)
	}

	return strings.TrimSpace(b.String())
}

func cleanURL(raw string) string {
	if strings.HasPrefix(raw, "//") {
		raw = "https:" + raw
	}
	decoded, err := url.QueryUnescape(raw)
	if err != nil {
		return raw
	}
	return decoded
}

func cleanHTML(s string) string {
	s = tagRe.ReplaceAllString(s, "")
	s = spaceRe.ReplaceAllString(s, " ")
	s = strings.TrimSpace(s)
	s = strings.ReplaceAll(s, "&amp;", "&")
	s = strings.ReplaceAll(s, "&lt;", "<")
	s = strings.ReplaceAll(s, "&gt;", ">")
	s = strings.ReplaceAll(s, "&quot;;", "\"")
	s = strings.ReplaceAll(s, "&#39;", "'")
	return s
}

func getLastUserMessage(msgs []Message) string {
	for i := len(msgs) - 1; i >= 0; i-- {
		if msgs[i].Role == "user" {
			return msgs[i].Content
		}
	}
	return ""
}

func shouldSearch(msg string) bool {
	return strings.HasPrefix(strings.TrimSpace(msg), "!")
}
