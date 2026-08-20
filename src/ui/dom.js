// Tiny DOM helpers shared by every panel/view. No framework on purpose.

export function escapeHtml(s = '') {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** el('div.panel', { id: 'x' }, child|string, …) */
export function el(spec, props = {}, ...children) {
  const [tag, ...classes] = String(spec).split('.');
  const node = document.createElement(tag || 'div');
  if (classes.length) node.className = classes.join(' ');
  for (const [k, v] of Object.entries(props || {})) {
    if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v != null) node.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null) continue;
    node.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return node;
}

/** A labelled range slider that reports live values. */
export function slider({ label, min, max, step = 1, value, format = (v) => v, onInput }) {
  const out = el('span.zk-slider-value', { text: format(value) });
  const input = el('input', { type: 'range', min, max, step, value });
  input.addEventListener('input', () => {
    const v = Number(input.value);
    out.textContent = format(v);
    onInput(v);
  });
  const row = el('label.zk-slider', {}, el('span.zk-slider-label', { text: label }), out, input);
  row.setValue = (v) => {
    input.value = v;
    out.textContent = format(Number(v));
  };
  return row;
}

export function checkbox({ label, checked, onChange }) {
  const input = el('input', { type: 'checkbox' });
  input.checked = !!checked;
  input.addEventListener('change', () => onChange(input.checked));
  const row = el('label.zk-check', {}, input, el('span', { text: label }));
  row.setChecked = (v) => { input.checked = !!v; };
  return row;
}
