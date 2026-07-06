// sockets/collabHandler.js
//
// This file is the heart of the "real-time" part of the project.
// It runs on every WebSocket connection and handles:
//   1. Joining a document's "room" (so edits only broadcast to people
//      viewing that same document)
//   2. Presence / activity tracking (who's currently online)
//   3. Broadcasting edits to everyone else in the room instantly
//   4. Conflict handling using a "version number" strategy
//   5. Role-based access — viewers cannot edit, only owners/editors can
//   6. Saving a Revision snapshot on every accepted edit (version history)
//   7. Broadcasting live cursor position to other collaborators
//
// --- How the conflict handling works (explain this in your viva!) ---
// Every document has a `version` number starting at 0.
// When a user sends an edit, they also send the version they were
// editing FROM. The server checks: does that match the current version
// in the database?
//   - If YES: no one else has saved a newer edit in between → we accept
//     the edit, save it, bump the version to +1, and broadcast the new
//     content + version to everyone in the room.
//   - If NO: someone else's edit got saved first (a conflict!) → instead
//     of silently overwriting their work, we reject the edit and send
//     the sender the latest content so their editor can refresh and
//     they can redo their change on top of the newest version.
// This is a simplified version of "optimistic concurrency control",
// the same core idea Google Docs and Git both use.

const jwt = require('jsonwebtoken');
const Document = require('../models/Document');
const Revision = require('../models/Revision');

// In-memory map of who is currently active in each document room.
// Structure: { documentId: { socketId: userName } }
// NOTE: this resets if the server restarts — fine for a student project,
// but a production app might use Redis instead (see poster's "Other Tools").
const activeUsers = {};

function registerCollabHandlers(io) {
  // Middleware that runs once per new socket connection, BEFORE any events.
  // It reads the JWT the frontend attaches and verifies it, so we know
  // WHO is connecting (same idea as middleware/auth.js, but for sockets).
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = decoded; // { id, name }
      next();
    } catch (err) {
      next(new Error('Socket authentication failed'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.user.name} (${socket.id})`);

    // --- 1. Join a document room ---
    socket.on('join-document', async ({ documentId }) => {
      socket.join(documentId);
      socket.currentDoc = documentId;

      if (!activeUsers[documentId]) activeUsers[documentId] = {};
      activeUsers[documentId][socket.id] = socket.user.name;

      // Tell everyone in the room (including the new joiner) who's online now
      io.to(documentId).emit('active-users', Object.values(activeUsers[documentId]));

      // Let others know someone joined (Activity Tracking feature)
      socket.to(documentId).emit('activity', {
        user: socket.user.name,
        action: 'joined the document',
        timestamp: new Date(),
      });
    });

    // --- 2. Handle an incoming edit ---
    socket.on('edit-document', async ({ documentId, content, baseVersion }) => {
      try {
        const doc = await Document.findById(documentId);
        if (!doc) return;

        // Role check: only the owner or an "editor" collaborator may save
        // changes. A "viewer" socket should never send this event (the
        // frontend disables typing for them), but we double-check here
        // too — never trust the client alone for permission checks.
        const role = doc.getRoleFor(socket.user.id);
        if (role !== 'owner' && role !== 'editor') {
          socket.emit('edit-rejected', { reason: 'You only have view access to this document' });
          return;
        }

        if (doc.version !== baseVersion) {
          // CONFLICT: someone else saved a newer version already.
          // Send the latest content back to ONLY the sender so they can reconcile.
          socket.emit('edit-conflict', {
            latestContent: doc.content,
            latestVersion: doc.version,
          });
          return;
        }

        // Snapshot the OLD content into revision history before overwriting,
        // so "Version History" always has something to show and restore.
        await Revision.create({
          document: doc._id,
          content: doc.content,
          version: doc.version,
          editedBy: socket.user.name,
        });

        // No conflict — accept the edit.
        doc.content = content;
        doc.version += 1;
        doc.activityLog.push({ user: socket.user.name, action: 'edited the document' });
        // Keep the activity log from growing forever
        if (doc.activityLog.length > 50) doc.activityLog = doc.activityLog.slice(-50);
        await doc.save();

        // Broadcast the accepted edit to everyone ELSE in the room.
        socket.to(documentId).emit('document-updated', {
          content: doc.content,
          version: doc.version,
          editedBy: socket.user.name,
        });
      } catch (err) {
        console.error('Error handling edit-document:', err.message);
      }
    });

    // --- 3. Live cursor tracking ---
    // The frontend sends this often (on every click/keystroke), so we do
    // NOT touch the database here — just relay the position in memory.
    // Each cursor is tagged with the sender's socket id so the frontend can
    // tell multiple collaborators' cursors apart and assign each a color.
    socket.on('cursor-move', ({ documentId, cursorIndex }) => {
      socket.to(documentId).emit('cursor-update', {
        socketId: socket.id,
        user: socket.user.name,
        cursorIndex,
      });
    });

    // --- 4. Handle disconnect (leaving) ---
    socket.on('disconnect', () => {
      const documentId = socket.currentDoc;
      if (documentId && activeUsers[documentId]) {
        delete activeUsers[documentId][socket.id];
        io.to(documentId).emit('active-users', Object.values(activeUsers[documentId]));
        // Tell others this cursor is gone so it doesn't linger on screen
        socket.to(documentId).emit('cursor-remove', { socketId: socket.id });
        socket.to(documentId).emit('activity', {
          user: socket.user.name,
          action: 'left the document',
          timestamp: new Date(),
        });
      }
      console.log(`Socket disconnected: ${socket.user.name}`);
    });
  });
}

module.exports = registerCollabHandlers;
