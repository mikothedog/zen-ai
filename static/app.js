const COPY_FEEDBACK_DURATION = 2000;
const SCROLL_THRESHOLD = 80;
const SCROLL_STEP = 200;
const INPUT_MAX_HEIGHT = 200;
const STREAM_INIT_DELAY = 400;

let currentModel = '';
let abortController = null;
let nearBottom = true;

const chatEl = document.getElementById('messages');
const chatContainer = document.getElementById('chat');
const loadingEl = document.getElementById('loading');
const inputEl = document.getElementById('input');
const sendBtn = document.getElementById('send');
const dropdownToggle = document.querySelector('.dropdown-toggle');
const dropdownMenu = document.querySelector('.dropdown-menu');

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

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderMarkdown(text) {
  const codeBlocks = [];
  let idx = 0;
  let html = text.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const placeholder = `\x00CODE${idx}\x00`;
    codeBlocks.push(`<pre><code>${escapeHtml(code)}</code></pre>`);
    idx++;
    return placeholder;
  });

  html = escapeHtml(html);

  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

  html = html.replace(/^- (.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>');

  html = html.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank" class="external-link">$1</a>');

  html = html.replace(/\x00CODE(\d+)\x00/g, (_, i) => {
    return codeBlocks[parseInt(i)] || _;
  });

  const lines = html.split('\n\n');
  return lines.map(line => {
    const t = line.trim();
    if (!t) return '';
    if (t.startsWith('<')) return t;
    return `<p>${t}</p>`;
  }).join('\n');
}

async function copyToClipboard(text, button) {
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Copied!';
    button.classList.add('copied');
    setTimeout(() => {
      button.textContent = 'Copy';
      button.classList.remove('copied');
    }, COPY_FEEDBACK_DURATION);
  } catch {
    button.textContent = 'Failed';
  }
}

function addCodeCopyButtons(el) {
  el.querySelectorAll('pre').forEach(pre => {
    if (pre.parentElement.classList.contains('code-block-wrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'code-block-wrap';
    pre.parentNode.insertBefore(wrap, pre);
    wrap.appendChild(pre);
    const btn = document.createElement('button');
    btn.className = 'copy-code-btn';
    btn.textContent = 'Copy';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      copyToClipboard(pre.textContent, btn);
    });
    wrap.appendChild(btn);
  });
}

function addMessageActions(el) {
  if (el.querySelector('.message-actions')) return;
  const actions = document.createElement('div');
  actions.className = 'message-actions';
  const copyBtn = document.createElement('button');
  const content = el.dataset.content || el.textContent;
  copyBtn.textContent = 'Copy';
  copyBtn.addEventListener('click', () => copyToClipboard(content, copyBtn));
  actions.appendChild(copyBtn);
  el.appendChild(actions);
}

function renderMath(el) {
  if (typeof renderMathInElement !== 'function') return;
  try {
    renderMathInElement(el, {
      delimiters: [
        { left: '\\[', right: '\\]', display: true },
        { left: '\\(', right: '\\)', display: false },
      ],
      ignoredTags: ['pre', 'code'],
    });
  } catch (_) {}
}

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

function setModel(name) {
  currentModel = name;
  dropdownToggle.textContent = name || 'Select model...';
  dropdownMenu.querySelectorAll('li').forEach(li => {
    li.classList.toggle('active', li.dataset.model === name);
  });
  dropdownMenu.classList.remove('open');
  sendBtn.disabled = !name;
}

function classifyModel(name) {
  const n = name.toLowerCase();
  if (n.includes('deepseek') || n.includes('r1') || n.includes('reason')) return 'think';
  if (n.includes('coder') || n.includes('code') || n.includes('instruct')) return 'code';
  return 'ask';
}

function selectModelForMode(mode, models) {
  if (models.length === 0) return '';
  const targetMode = mode || 'ask';
  for (const m of models) {
    if (classifyModel(m.name) === targetMode) return m.name;
  }
  return models[0].name;
}

function parseModeFromQuery(query) {
  const match = query.match(/^:(think|ask|code)\s+/);
  if (!match) return { query, mode: null };
  return { query: query.slice(match[0].length), mode: match[1] };
}

async function loadModels(preferredMode) {
  try {
    const res = await fetch('/api/models');
    if (!res.ok) throw new Error('Failed to fetch models');
    const models = await res.json();
    dropdownMenu.innerHTML = '';
    if (models.length === 0) {
      const li = document.createElement('li');
      li.textContent = 'No models installed (run ollama pull ...)';
      li.dataset.model = '';
      dropdownMenu.appendChild(li);
      setModel('');
      return;
    }
    models.forEach(m => {
      const li = document.createElement('li');
      li.textContent = m.name;
      li.dataset.model = m.name;
      li.addEventListener('click', () => setModel(m.name));
      dropdownMenu.appendChild(li);
    });
    setModel(selectModelForMode(preferredMode, models));
  } catch (e) {
    console.error('Failed to load models:', e);
    const li = document.createElement('li');
    li.textContent = 'Error loading models';
    li.dataset.model = '';
    dropdownMenu.appendChild(li);
    setModel('');
  }
}

dropdownToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  dropdownMenu.classList.toggle('open');
});

document.addEventListener('click', () => {
  dropdownMenu.classList.remove('open');
});

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
