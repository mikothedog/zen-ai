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

  html = html.replace(/^\|.+\|\n\|[\s|:-]+\|\n(?:\|.+\|\n?)*/gm, (block) => {
    const lines = block.trim().split('\n');
    if (lines.length < 2) return block;
    const headers = lines[0].split('|').slice(1, -1).map(c => c.trim());
    const aligns = lines[1].split('|').slice(1, -1).map(a => {
      const t = a.trim();
      if (t.startsWith(':') && t.endsWith(':')) return 'center';
      if (t.endsWith(':')) return 'right';
      return 'left';
    });
    let table = '<table>\n<thead>\n<tr>';
    headers.forEach((h, i) => {
      table += `<th align="${aligns[i] || 'left'}">${h}</th>`;
    });
    table += '</tr>\n</thead>\n<tbody>\n';
    for (let r = 2; r < lines.length; r++) {
      if (!lines[r].trim()) continue;
      const cells = lines[r].split('|').slice(1, -1).map(c => c.trim());
      table += '<tr>';
      cells.forEach((c, i) => {
        table += `<td align="${aligns[i] || 'left'}">${c}</td>`;
      });
      table += '</tr>\n';
    }
    table += '</tbody>\n</table>';
    return table;
  });

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
