// models/Document.js
// Defines a "Document" that multiple users can edit together in real time.
// The `version` field is the key to our conflict-handling strategy (explained
// in sockets/collabHandler.js).

const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema(
  {
    user: { type: String, required: true }, // name of user who did the action
    action: { type: String, required: true }, // e.g. "edited", "joined", "left"
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

// Each collaborator is stored WITH a role, not just as a bare user id.
// This is what "Role-Based Access" needs: we must know not just WHO has
// access, but WHAT they're allowed to do (edit vs just view).
const collaboratorSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['editor', 'viewer'], default: 'editor' },
  },
  { _id: false }
);

const documentSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, default: 'Untitled Document' },
    content: { type: String, default: '' }, // the actual text content
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    collaborators: [collaboratorSchema],
    version: { type: Number, default: 0 }, // increments on every saved edit
    activityLog: [activityLogSchema], // last N actions, for "Activity Tracking" feature
  },
  { timestamps: true }
);

// Helper: given a user id, returns 'owner', 'editor', 'viewer', or null
// (null = this user has no access at all). Used by both REST routes and
// the socket handler so access rules live in ONE place, not copy-pasted.
documentSchema.methods.getRoleFor = function (userId) {
  const idStr = userId.toString();
  if (this.owner.toString() === idStr) return 'owner';
  const collab = this.collaborators.find((c) => c.user.toString() === idStr);
  return collab ? collab.role : null;
};

module.exports = mongoose.model('Document', documentSchema);
