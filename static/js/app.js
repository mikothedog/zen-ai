let abortController = null;
let nearBottom = true;

function isNearBottom() {
  return chatContainer.scrollTop + chatContainer.clientHeight >= chatContainer.scrollHeight - SCROLL_THRESHOLD;
}

function scrollToBottom() {
  if (!isNearBottom()) return;
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

function scrollToBottomForce() {
  nearBottom = true;
  chatContainer.scrollTop = chatContainer.scrollHeight;
}

chatContainer.addEventListener('wheel', () => {
  nearBottom = false;
});

chatContainer.addEventListener('scroll', () => {
  nearBottom = isNearBottom();
});

function addMessage(role, content) {
  const el = document.createElement('div');
  el.className = 'message ' + role;
  el.dataset.content = content;
  if (role === 'assistant') {
    el.innerHTML = renderMarkdown(content) || '\u200B';
    renderMath(el);
    addCodeCopyButtons(el);
    addMessageActions(el);
  } else {
    el.textContent = content;
  }
  chatEl.appendChild(el);
  if (role === 'user') scrollToBottomForce();
  return el;
}

function updateLastMessage(content) {
  let last = chatEl.lastElementChild;
  if (!last || !last.classList.contains('assistant')) {
    last = addMessage('assistant', '');
  }
  last.innerHTML = renderMarkdown(content) || '\u200B';
  last.dataset.content = content;
  renderMath(last);
  addCodeCopyButtons(last);
  addMessageActions(last);
  if (nearBottom) scrollToBottomForce();
}

function setLoading(show) {
  loadingEl.classList.toggle('hidden', !show);
}

function toggleInput(disabled) {
  inputEl.disabled = disabled;
  sendBtn.disabled = disabled;
}

function collectMessages() {
  const messages = [];
  document.querySelectorAll('.message').forEach(el => {
    const role = el.classList.contains('user') ? 'user' : 'assistant';
    messages.push({ role, content: el.dataset.content || el.textContent });
  });
  return messages;
}

async function readStream(reader, decoder, onChunk) {
  let buf = '';
  let full = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split('\n');
    buf = lines.pop() || '';

    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const chunk = JSON.parse(line);
        full += chunk.content;
        onChunk(full, chunk.done);
        if (chunk.done) break;
      } catch (_) {}
    }
  }

  if (buf.trim()) {
    try {
      const chunk = JSON.parse(buf);
      full += chunk.content;
      onChunk(full, chunk.done);
    } catch (_) {}
  }
}

async function sendMessage(content) {
  if (!content.trim()) return;
  const { query } = parseModeFromQuery(content);
  content = query;
  if (!content.trim()) return;
  if (!currentModel) {
    updateLastMessage('Error: no Ollama model available. Run `ollama pull <model>` first.');
    return;
  }

  if (abortController) abortController.abort();
  abortController = new AbortController();

  addMessage('user', content);
  inputEl.value = '';
  inputEl.style.height = 'auto';
  setLoading(true);
  toggleInput(true);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: currentModel, messages: collectMessages() }),
      signal: abortController.signal,
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(text || 'Request failed');
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    await readStream(reader, decoder, (full, done) => {
      updateLastMessage(full);
    });
  } catch (err) {
    if (err.name !== 'AbortError') {
      updateLastMessage('Error: ' + err.message);
    }
  }

  setLoading(false);
  toggleInput(false);
  inputEl.focus();
  abortController = null;
}

inputEl.addEventListener('input', () => {
  inputEl.style.height = 'auto';
  inputEl.style.height = Math.min(inputEl.scrollHeight, INPUT_MAX_HEIGHT) + 'px';
});

inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage(inputEl.value);
  }
});

sendBtn.addEventListener('click', () => {
  sendMessage(inputEl.value);
});

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
    switch (e.key) {
      case 'l':
        e.preventDefault();
        e.stopPropagation();
        inputEl.focus();
        break;
      case 'j':
        e.preventDefault();
        e.stopPropagation();
        chatContainer.scrollTop += SCROLL_STEP;
        nearBottom = isNearBottom();
        break;
      case 'g':
        e.preventDefault();
        e.stopPropagation();
        scrollToBottomForce();
        break;
      case 'k':
        e.preventDefault();
        e.stopPropagation();
        chatContainer.scrollTop -= SCROLL_STEP;
        nearBottom = false;
        break;
    }
  }
});

document.addEventListener('click', (e) => {
  const link = e.target.closest('a.external-link');
  if (link && link.href) {
    e.preventDefault();
    if (typeof openURL === 'function') {
      openURL(link.href);
    } else {
      window.open(link.href, '_blank');
    }
  }
});

const rawQuery = (new URLSearchParams(window.location.search)).get('q') || '';
const { query: initialQuery, mode: initialMode } = parseModeFromQuery(rawQuery);
loadModels(initialMode);

window.addEventListener('beforeunload', () => {
  navigator.sendBeacon('/api/shutdown');
});

if (initialQuery) {
  setTimeout(() => sendMessage(initialQuery), STREAM_INIT_DELAY);
  history.replaceState(null, '', '/');
}
