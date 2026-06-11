import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnv, evalJS } from './setup.js';

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

  it('should escape HTML in code blocks once', () => {
    const result = window.renderMarkdown('```\n<script>alert(1)</script>\n```');
    assert.ok(result.includes('&lt;script'));
    assert.ok(!result.includes('&amp;lt;'));
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

  it('should render tables with table/thead/tbody tags', () => {
    const input = '| A | B |\n| :--- | :---: |\n| 1 | 2 |\n| 3 | 4 |';
    const result = window.renderMarkdown(input);
    assert.ok(result.includes('<table>'));
    assert.ok(result.includes('<thead>'));
    assert.ok(result.includes('<tbody>'));
    assert.ok(result.includes('<th align="left">A</th>'));
    assert.ok(result.includes('<th align="center">B</th>'));
    assert.ok(result.includes('<td align="left">1</td>'));
    assert.ok(result.includes('<td align="center">2</td>'));
  });

  it('should not wrap tables in <p> tags', () => {
    const result = window.renderMarkdown('| X | Y |\n| :--- | :--- |\n| a | b |');
    assert.ok(result.includes('<table>'));
    assert.ok(!result.includes('<p><table>'));
  });

  it('should pass $...$ inline math through for KaTeX', () => {
    const result = window.renderMarkdown('$\\rightarrow$');
    assert.ok(result.includes('$\\rightarrow$'));
    assert.ok(!result.includes('&gt;'));
  });

  it('should pass $$...$$ display math through for KaTeX', () => {
    const result = window.renderMarkdown('$$\\sum_{i=1}^n i$$');
    assert.ok(result.includes('$$\\sum_{i=1}^n i$$'));
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
      { left: '$$', right: '$$', display: true },
      { left: '\\[', right: '\\]', display: true },
      { left: '$', right: '$', display: false },
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
