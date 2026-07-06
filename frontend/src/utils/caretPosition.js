// src/utils/caretPosition.js
//
// A plain <textarea> has no built-in way to ask "where on screen is
// character number 47?" — it only knows about the whole block of text.
// To draw OTHER people's cursors on top of the textarea, we need that
// pixel position ourselves.
//
// The trick (a well-known technique): create an invisible "mirror" div
// off-screen with the EXACT same font/padding/width as the textarea,
// fill it with the same text, wrap a <span> around the character we
// care about, and ask the browser where that span landed. Since the
// mirror is styled identically, the answer matches the real textarea.

const MIRRORED_PROPERTIES = [
  'boxSizing', 'width', 'height', 'overflowX', 'overflowY',
  'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
  'fontStyle', 'fontVariant', 'fontWeight', 'fontSize', 'lineHeight',
  'fontFamily', 'textAlign', 'textIndent', 'letterSpacing', 'wordSpacing',
];

export function getCaretCoordinates(textareaEl, index) {
  const style = window.getComputedStyle(textareaEl);

  const mirror = document.createElement('div');
  MIRRORED_PROPERTIES.forEach((prop) => {
    mirror.style[prop] = style[prop];
  });
  mirror.style.position = 'absolute';
  mirror.style.visibility = 'hidden';
  mirror.style.whiteSpace = 'pre-wrap';
  mirror.style.wordWrap = 'break-word';
  mirror.style.top = '0';
  mirror.style.left = '-9999px';

  const textBefore = textareaEl.value.substring(0, index);
  const textAfter = textareaEl.value.substring(index) || '.';

  mirror.textContent = textBefore;

  const marker = document.createElement('span');
  marker.textContent = textAfter[0] === '\n' ? ' ' : textAfter[0];
  mirror.appendChild(marker);

  document.body.appendChild(mirror);
  const top = marker.offsetTop - textareaEl.scrollTop;
  const left = marker.offsetLeft - textareaEl.scrollLeft;
  document.body.removeChild(mirror);

  return { top, left };
}

// A small, fixed palette so each collaborator gets a consistent-looking
// color without us needing a server-assigned color scheme.
const CURSOR_COLORS = ['#EF4444', '#3B82F6', '#F59E0B', '#8B5CF6', '#EC4899', '#10B981'];

export function colorForUser(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}
