import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestEnv, evalJS } from './setup.js';

let window, document;

beforeEach(() => {
  const env = createTestEnv();
  window = env.window;
  document = env.document;
  window.renderMathInElement = () => {};
  evalJS(window);
});

describe('clipboard', () => {
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

  it('should reset button text after feedback duration', async () => {
    const btn = document.createElement('button');
    window.navigator.clipboard.writeText = async () => {};
    await window.copyToClipboard('hello', btn);
    assert.equal(btn.textContent, 'Copied!');
    await new Promise(r => setTimeout(r, 2100));
    assert.equal(btn.textContent, 'Copy');
    assert.ok(!btn.classList.contains('copied'));
  });
});
