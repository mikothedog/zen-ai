import { describe, it, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let dom, window, document;

before(() => {
  dom = new JSDOM(`
    <!DOCTYPE html>
    <div id="messages"></div>
    <div id="chat" style="height: 500px; overflow-y: auto;"><div id="messages"></div></div>
    <div id="loading" class="hidden"></div>
    <textarea id="input"></textarea>
    <button id="send"></button>
    <div class="dropdown-toggle">deepseek-r1:14b</div>
    <ul class="dropdown-menu"></ul>
  `, {
    url: 'http://localhost',
    pretendToBeVisual: true,
    runScripts: 'outside-only',
  });
  window = dom.window;
  document = window.document;

  const { navigator } = window;
  navigator.clipboard = { writeText: async () => {} };
});

beforeEach(() => {
  window.renderMathInElement = (el, opts) => {
    el.dataset.mathRendered = 'true';
    el.dataset.mathOpts = JSON.stringify(opts);
  };
  const script = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf-8');
  window.eval(script);
});

describe('copyToClipboard', () => {
  it('should set button text to Copied! and add copied class', async () => {
    const btn = document.createElement('button');
    window.navigator.clipboard.writeText = async (text) => {
      assert.equal(text, 'hello');
    };
    await window.copyToClipboard('hello', btn);
    assert.equal(btn.textContent, 'Copied!');
    assert.ok(btn.classList.contains('copied'));
  });

  it('should set button text to Failed on clipboard error', async () => {
    const btn = document.createElement('button');
    window.navigator.clipboard.writeText = async () => {
      throw new Error('fail');
    };
    await window.copyToClipboard('hello', btn);
    assert.equal(btn.textContent, 'Failed');
  });

  it('should reset button text after 2s', async () => {
    const btn = document.createElement('button');
    window.navigator.clipboard.writeText = async () => {};
    await window.copyToClipboard('hello', btn);
    assert.equal(btn.textContent, 'Copied!');
    assert.ok(btn.classList.contains('copied'));
    await new Promise(r => setTimeout(r, 2100));
    assert.equal(btn.textContent, 'Copy');
    assert.ok(!btn.classList.contains('copied'));
  });
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

describe('renderMarkdown', () => {
  it('should render code blocks with pre/code tags', () => {
    const result = window.renderMarkdown('```js\nconsole.log("hi")\n```');
    assert.ok(result.includes('<pre><code>'));
    assert.ok(result.includes('console.log("hi")'));
  });

  it('should render inline code', () => {
    const result = window.renderMarkdown('use `code` here');
    assert.ok(result.includes('<code>code</code>'));
  });

  it('should render bold and italic', () => {
    const result = window.renderMarkdown('**bold** and *italic*');
    assert.ok(result.includes('<strong>bold</strong>'));
    assert.ok(result.includes('<em>italic</em>'));
  });

  it('should render links', () => {
    const result = window.renderMarkdown('[text](https://example.com)');
    assert.ok(result.includes('<a href="https://example.com"'));
  });

  it('should double-escape HTML in code blocks (existing behavior)', () => {
    const result = window.renderMarkdown('```\n<script>alert(1)</script>\n```');
    assert.ok(result.includes('&amp;lt;script'));
  });

  it('should render headings', () => {
    const h1 = window.renderMarkdown('# heading 1');
    const h2 = window.renderMarkdown('## heading 2');
    const h3 = window.renderMarkdown('### heading 3');
    assert.ok(h1.includes('<h1>heading 1</h1>'));
    assert.ok(h2.includes('<h2>heading 2</h2>'));
    assert.ok(h3.includes('<h3>heading 3</h3>'));
  });

  it('should render unordered lists', () => {
    const result = window.renderMarkdown('- item 1\n- item 2');
    assert.ok(result.includes('<ul>'));
    assert.ok(result.includes('<li>item 1</li>'));
    assert.ok(result.includes('<li>item 2</li>'));
  });

  it('should render paragraphs for plain text', () => {
    const result = window.renderMarkdown('hello\nworld');
    assert.ok(result.includes('<p>hello\nworld</p>'));
  });

  it('should pass \\[ ... \\] and \\( ... \\) through unchanged', () => {
    const result = window.renderMarkdown('\\[ \\boxed{100} \\] and \\( x^2 \\)');
    assert.ok(result.includes('\\[ \\boxed{100} \\]'));
    assert.ok(result.includes('\\( x^2 \\)'));
  });

  it('should keep \\boxed{} and LaTeX commands unmodified', () => {
    const result = window.renderMarkdown('\\boxed{42} \\alpha \\rightarrow \\frac{1}{2}');
    assert.ok(result.includes('\\boxed{42}'));
    assert.ok(result.includes('\\alpha'));
    assert.ok(result.includes('\\rightarrow'));
    assert.ok(result.includes('\\frac{1}{2}'));
  });

  it('should keep LaTeX inside code blocks untouched', () => {
    const result = window.renderMarkdown('```\n\\[ \\boxed{100} \\]\n```');
    assert.ok(result.includes('\\[ \\boxed{100} \\]'));
    assert.ok(result.includes('<pre><code>'));
  });
});

describe('renderMath', () => {
  it('should call renderMathInElement with correct delimiters', () => {
    const el = document.createElement('div');
    el.textContent = '\\[ x^2 \\]';
    window.renderMath(el);
    assert.equal(el.dataset.mathRendered, 'true');
    const opts = JSON.parse(el.dataset.mathOpts);
    assert.deepEqual(opts.delimiters, [
      { left: '\\[', right: '\\]', display: true },
      { left: '\\(', right: '\\)', display: false },
    ]);
    assert.deepEqual(opts.ignoredTags, ['pre', 'code']);
  });

  it('should not throw when renderMathInElement is undefined', () => {
    const orig = window.renderMathInElement;
    delete window.renderMathInElement;
    const el = document.createElement('div');
    window.renderMath(el);
    window.renderMathInElement = orig;
  });
});

describe('escapeHtml', () => {
  it('should escape <, >, &', () => {
    assert.equal(window.escapeHtml('<>&'), '&lt;&gt;&amp;');
  });

  it('should return empty string for empty input', () => {
    assert.equal(window.escapeHtml(''), '');
  });

  it('should not double-escape already escaped text', () => {
    assert.equal(window.escapeHtml('&lt;'), '&amp;lt;');
  });
});
