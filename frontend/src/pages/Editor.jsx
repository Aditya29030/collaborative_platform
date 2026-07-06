// src/pages/Editor.jsx
//
// The main feature of the whole project: a text editor that multiple
// people can type in at the same time, with changes appearing live for
// everyone, conflict handling, live cursors, role-based access, and
// version history.

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import api from '../utils/api';
import Navbar from '../components/Navbar.jsx';
import ActiveUsers from '../components/ActiveUsers.jsx';
import RemoteCursors from '../components/RemoteCursors.jsx';
import InviteModal from '../components/InviteModal.jsx';
import VersionHistory from '../components/VersionHistory.jsx';

export default function Editor() {
  const { id: documentId } = useParams();

  const [content, setContent] = useState('');
  const [version, setVersion] = useState(0);
  const [title, setTitle] = useState('');
  const [titleDraft, setTitleDraft] = useState(''); // separate state so we only save on blur/enter
  const [myRole, setMyRole] = useState('viewer'); // safest default until we hear back from the server
  const [activeUsers, setActiveUsers] = useState([]);
  const [activityFeed, setActivityFeed] = useState([]);
  const [conflictNotice, setConflictNotice] = useState(false);
  const [permissionNotice, setPermissionNotice] = useState('');
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved'
  const [cursors, setCursors] = useState({}); // { socketId: { user, cursorIndex } }
  const [showInvite, setShowInvite] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const socketRef = useRef(null);
  const debounceRef = useRef(null);
  const textareaRef = useRef(null);
  // Track the latest version WITHOUT waiting for a re-render, since socket
  // event handlers close over stale state otherwise.
  const versionRef = useRef(0);

  const canEdit = myRole === 'owner' || myRole === 'editor';

  // --- Step 1: load the document's current content once, then connect the socket ---
  useEffect(() => {
    let socket;

    async function init() {
      const { data } = await api.get(`/documents/${documentId}`);
      setContent(data.content);
      setTitle(data.title);
      setTitleDraft(data.title);
      setVersion(data.version);
      setMyRole(data.myRole);
      versionRef.current = data.version;

      // Connect to the Socket.io server, passing our JWT so the backend
      // knows who we are (see sockets/collabHandler.js io.use(...)).
      socket = io('http://localhost:5000', {
        auth: { token: localStorage.getItem('token') },
      });
      socketRef.current = socket;

      socket.emit('join-document', { documentId });

      socket.on('active-users', (users) => setActiveUsers(users));

      socket.on('activity', (entry) => {
        setActivityFeed((prev) => [entry, ...prev].slice(0, 10));
      });

      // Another user's edit was accepted by the server — update our view.
      socket.on('document-updated', ({ content: newContent, version: newVersion, editedBy }) => {
        setContent(newContent);
        setVersion(newVersion);
        versionRef.current = newVersion;
        setActivityFeed((prev) => [{ user: editedBy, action: 'edited the document', timestamp: new Date() }, ...prev].slice(0, 10));
      });

      // Our own edit conflicted with someone else's — reload the latest content.
      socket.on('edit-conflict', ({ latestContent, latestVersion }) => {
        setContent(latestContent);
        setVersion(latestVersion);
        versionRef.current = latestVersion;
        setConflictNotice(true);
        setSaveStatus('saved');
        setTimeout(() => setConflictNotice(false), 4000);
      });

      // Server rejected our edit outright (e.g. we're a viewer) —
      // shouldn't normally happen since the UI disables typing, but the
      // server checks independently as a safety net.
      socket.on('edit-rejected', ({ reason }) => {
        setPermissionNotice(reason);
        setSaveStatus('saved');
        setTimeout(() => setPermissionNotice(''), 4000);
      });

      // Live cursor tracking: another user moved their cursor
      socket.on('cursor-update', ({ socketId, user, cursorIndex }) => {
        setCursors((prev) => ({ ...prev, [socketId]: { user, cursorIndex } }));
      });

      // That user disconnected — remove their cursor
      socket.on('cursor-remove', ({ socketId }) => {
        setCursors((prev) => {
          const next = { ...prev };
          delete next[socketId];
          return next;
        });
      });
    }

    init();

    return () => {
      if (socket) socket.disconnect();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [documentId]);

  // --- Step 2: handle local typing, debounced before sending to the server ---
  const handleChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    setSaveStatus('unsaved');

    // Debounce: wait 500ms after the user stops typing before broadcasting.
    // Without this, every single keystroke would trigger a network request.
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setSaveStatus('saving');
      socketRef.current.emit('edit-document', {
        documentId,
        content: newContent,
        baseVersion: versionRef.current,
      });
      setSaveStatus('saved');
    }, 500);
  };

  // --- Step 3: broadcast OUR cursor position whenever it moves ---
  // Fires on typing, clicking, or using arrow keys inside the textarea.
  const broadcastCursor = (e) => {
    if (!socketRef.current) return;
    socketRef.current.emit('cursor-move', {
      documentId,
      cursorIndex: e.target.selectionStart,
    });
  };

  // --- Renaming the document ---
  const saveTitleIfChanged = async () => {
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === title) {
      setTitleDraft(title); // revert if empty or unchanged
      return;
    }
    const { data } = await api.patch(`/documents/${documentId}/title`, { title: trimmed });
    setTitle(data.title);
    setTitleDraft(data.title);
  };

  // --- Restoring a version from history ---
  const handleRestored = (updatedDoc) => {
    setContent(updatedDoc.content);
    setVersion(updatedDoc.version);
    versionRef.current = updatedDoc.version;
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex justify-between items-start mb-4 gap-4">
          <div className="flex-1">
            {canEdit ? (
              <input
                value={titleDraft}
                onChange={(e) => setTitleDraft(e.target.value)}
                onBlur={saveTitleIfChanged}
                onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
                className="text-xl font-semibold bg-transparent border-b border-transparent hover:border-slate-300 focus:border-brand focus:outline-none w-full"
              />
            ) : (
              <h1 className="text-xl font-semibold">{title}</h1>
            )}
            <p className="text-xs text-slate-400 mt-1">
              {!canEdit && 'View only · '}
              {saveStatus === 'saving' && 'Saving...'}
              {saveStatus === 'saved' && 'All changes saved'}
              {saveStatus === 'unsaved' && 'Typing...'}
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <ActiveUsers users={activeUsers} />
            <div className="flex gap-2">
              <button
                onClick={() => setShowHistory(true)}
                className="text-xs border border-slate-300 hover:border-brand px-2 py-1 rounded transition"
              >
                History
              </button>
              {myRole === 'owner' && (
                <button
                  onClick={() => setShowInvite(true)}
                  className="text-xs bg-brand hover:bg-brand-dark text-white px-2 py-1 rounded transition"
                >
                  Invite
                </button>
              )}
            </div>
          </div>
        </div>

        {conflictNotice && (
          <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm rounded px-4 py-2 mb-3">
            Someone else edited this document at the same time — the content was refreshed
            with the latest version. Please redo your last change.
          </div>
        )}
        {permissionNotice && (
          <div className="bg-red-50 border border-red-300 text-red-800 text-sm rounded px-4 py-2 mb-3">
            {permissionNotice}
          </div>
        )}
        {!canEdit && (
          <div className="bg-slate-100 border border-slate-300 text-slate-600 text-sm rounded px-4 py-2 mb-3">
            You have view-only access to this document.
          </div>
        )}

        {/* Wrapper needs position:relative so the cursor overlay lines up exactly over the textarea */}
        <div className="relative">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleChange}
            onClick={broadcastCursor}
            onKeyUp={broadcastCursor}
            readOnly={!canEdit}
            rows={20}
            className={`w-full border rounded-lg p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-brand resize-none ${
              !canEdit ? 'bg-slate-50 text-slate-500' : ''
            }`}
            placeholder="Start typing... everyone viewing this document will see your changes live."
          />
          <RemoteCursors cursors={cursors} textareaRef={textareaRef} />
        </div>

        <div className="mt-4">
          <h2 className="text-sm font-medium text-slate-600 mb-2">Recent activity</h2>
          <ul className="text-xs text-slate-500 space-y-1">
            {activityFeed.map((entry, i) => (
              <li key={i}>
                <span className="font-medium text-slate-700">{entry.user}</span> {entry.action} —{' '}
                {new Date(entry.timestamp).toLocaleTimeString()}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {showInvite && <InviteModal documentId={documentId} onClose={() => setShowInvite(false)} />}
      {showHistory && (
        <VersionHistory
          documentId={documentId}
          onClose={() => setShowHistory(false)}
          onRestored={handleRestored}
        />
      )}
    </div>
  );
}
