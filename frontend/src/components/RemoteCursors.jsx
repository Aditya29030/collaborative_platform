// src/components/RemoteCursors.jsx
// Renders a small colored flag + blinking vertical line for each OTHER
// collaborator currently editing, positioned exactly where their text
// cursor is — this is the "Live cursor tracking" bonus feature.

import { getCaretCoordinates, colorForUser } from '../utils/caretPosition';

// cursors: { [socketId]: { user, cursorIndex } }
export default function RemoteCursors({ cursors, textareaRef }) {
  if (!textareaRef.current) return null;

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {Object.entries(cursors).map(([socketId, { user, cursorIndex }]) => {
        const { top, left } = getCaretCoordinates(textareaRef.current, cursorIndex);
        const color = colorForUser(user);
        return (
          <div
            key={socketId}
            className="absolute transition-all duration-100 ease-linear"
            style={{ top, left }}
          >
            {/* the blinking caret line */}
            <div className="w-0.5 h-5 animate-pulse" style={{ backgroundColor: color }} />
            {/* name flag */}
            <div
              className="text-[10px] text-white px-1.5 py-0.5 rounded-sm rounded-tl-none whitespace-nowrap -mt-4"
              style={{ backgroundColor: color }}
            >
              {user}
            </div>
          </div>
        );
      })}
    </div>
  );
}
