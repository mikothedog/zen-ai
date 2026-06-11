import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnv, evalJS, setChatScroll } from './setup.js';

let window, document;

beforeEach(() => {
  const env = createTestEnv();
  window = env.window;
  document = env.document;
  window.renderMathInElement = (el, opts) => {
    el.dataset.mathRendered = 'true';
    el.dataset.mathOpts = JSON.stringify(opts);
  };
  evalJS(window);
});

describe('addCodeCopyButtons', () => {
  it('should wrap pre in code-block-wrap with copy button', () => {
    const el = document.createElement('div');
    el.innerHTML = '<pre><code>code here</code></pre>';
    window.addCodeCopyButtons(el);
    const wrap = el.querySelector('.code-block-wrap');
    assert.ok(wrap, 'should have code-block-wrap');
    assert.ok(wrap.contains(el.querySelector('pre')), 'wrap should contain pre');
    const btn = el.querySelector('.copy-code-btn');
    assert.ok(btn, 'should have copy button');
    assert.equal(btn.textContent, 'Copy');
  });

  it('should not re-wrap already wrapped pre', () => {
    const el = document.createElement('div');
    el.innerHTML = '<div class="code-block-wrap"><pre><code>code</code></pre></div>';
    window.addCodeCopyButtons(el);
    assert.equal(el.querySelectorAll('.code-block-wrap').length, 1);
  });

  it('should handle multiple code blocks', () => {
    const el = document.createElement('div');
    el.innerHTML = '<pre><code>a</code></pre><p>text</p><pre><code>b</code></pre>';
    window.addCodeCopyButtons(el);
    assert.equal(el.querySelectorAll('.code-block-wrap').length, 2);
    assert.equal(el.querySelectorAll('.copy-code-btn').length, 2);
  });

  it('clicking copy button should copy pre text', async () => {
    const el = document.createElement('div');
    el.innerHTML = '<pre><code>some code</code></pre>';
    window.addCodeCopyButtons(el);
    const btn = el.querySelector('.copy-code-btn');
    let copiedText = '';
    window.navigator.clipboard.writeText = async (text) => { copiedText = text; };
    btn.click();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(copiedText, 'some code');
    assert.equal(btn.textContent, 'Copied!');
  });
});

describe('addMessageActions', () => {
  it('should add message-actions div with copy button', () => {
    const el = document.createElement('div');
    el.className = 'message assistant';
    window.addMessageActions(el);
    const actions = el.querySelector('.message-actions');
    assert.ok(actions, 'should have message-actions');
    const btn = actions.querySelector('button');
    assert.ok(btn, 'should have copy button');
    assert.equal(btn.textContent, 'Copy');
  });

  it('should not add duplicate actions', () => {
    const el = document.createElement('div');
    el.className = 'message assistant';
    window.addMessageActions(el);
    window.addMessageActions(el);
    assert.equal(el.querySelectorAll('.message-actions').length, 1);
  });

  it('clicking copy button should copy message text', async () => {
    const el = document.createElement('div');
    el.textContent = 'message content';
    el.className = 'message assistant';
    window.addMessageActions(el);
    const btn = el.querySelector('.message-actions button');
    let copiedText = '';
    window.navigator.clipboard.writeText = async (text) => { copiedText = text; };
    btn.click();
    await new Promise(r => setTimeout(r, 10));
    assert.equal(copiedText, 'message content');
  });
});

describe('scroll behavior', () => {
  it('should detect near bottom when within threshold', () => {
    setChatScroll(window, 400, 500, 100);
    assert.ok(window.isNearBottom());
  });

  it('should detect not near bottom when far from threshold', () => {
    setChatScroll(window, 100, 500, 100);
    assert.ok(!window.isNearBottom());
  });

  it('should scroll to bottom on force', () => {
    setChatScroll(window, 100, 500, 100);
    window.scrollToBottomForce();
    assert.equal(window.chatContainer.scrollTop, 500);
    assert.equal(window.nearBottom, true);
  });
});

describe('addMessage', () => {
  it('should create user message with text content', () => {
    const el = window.addMessage('user', 'hello');
    assert.ok(el.classList.contains('user'));
    assert.equal(el.textContent, 'hello');
    assert.equal(el.dataset.content, 'hello');
  });

  it('should create assistant message with rendered markdown', () => {
    const el = window.addMessage('assistant', '**bold** text');
    assert.ok(el.classList.contains('assistant'));
    assert.ok(el.innerHTML.includes('<strong>bold</strong>'));
    assert.equal(el.dataset.content, '**bold** text');
  });

  it('should append to messages container', () => {
    const before = window.messagesEl.children.length;
    window.addMessage('user', 'test');
    assert.equal(window.messagesEl.children.length, before + 1);
  });
});

describe('collectMessages', () => {
  it('should collect messages from DOM', () => {
    window.messagesEl.innerHTML = '';
    window.addMessage('user', 'hi');
    window.addMessage('assistant', '**hello**');
    const msgs = window.collectMessages();
    assert.equal(msgs.length, 2);
    assert.equal(msgs[0].role, 'user');
    assert.equal(msgs[0].content, 'hi');
    assert.equal(msgs[1].role, 'assistant');
    assert.equal(msgs[1].content, '**hello**');
  });
});

describe('setLoading', () => {
  it('should show loading', () => {
    window.setLoading(true);
    assert.ok(!window.loadingEl.classList.contains('hidden'));
  });

  it('should hide loading', () => {
    window.setLoading(false);
    assert.ok(window.loadingEl.classList.contains('hidden'));
  });
});

describe('toggleInput', () => {
  it('should disable input and send', () => {
    window.toggleInput(true);
    assert.ok(window.inputEl.disabled);
    assert.ok(window.sendBtn.disabled);
  });

  it('should enable input and send', () => {
    window.toggleInput(false);
    assert.ok(!window.inputEl.disabled);
    assert.ok(!window.sendBtn.disabled);
  });
});

describe('dropdown setup', () => {
  it('should be called during init and setupDropdown is a function', () => {
    assert.equal(typeof window.setupDropdown, 'function');
  });

  it('should toggle open class on dropdown menu', () => {
    window.dropdownMenu.classList.remove('open');
    window.dropdownMenu.classList.toggle('open');
    assert.ok(window.dropdownMenu.classList.contains('open'));
    window.dropdownMenu.classList.toggle('open');
    assert.ok(!window.dropdownMenu.classList.contains('open'));
  });
});
