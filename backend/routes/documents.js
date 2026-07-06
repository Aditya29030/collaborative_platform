// routes/documents.js
// CRUD (Create, Read, Update, Delete) endpoints for documents, plus
// role-based invites and version history.
// Every route here uses the `protect` middleware, meaning you MUST be
// logged in (send a valid JWT) to reach any of them.

const express = require('express');
const Document = require('../models/Document');
const Revision = require('../models/Revision');
const User = require('../models/User');
const { protect } = require('../middleware/auth');

const router = express.Router();

// GET /api/documents
// Returns every document the logged-in user owns OR collaborates on.
router.get('/', protect, async (req, res) => {
  try {
    const docs = await Document.find({
      $or: [{ owner: req.user.id }, { 'collaborators.user': req.user.id }],
    })
      .select('title updatedAt owner collaborators') // don't send full content in the list view
      .sort({ updatedAt: -1 });

    res.json(docs);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch documents', error: err.message });
  }
});

// POST /api/documents
// Creates a new, empty document owned by the logged-in user.
router.post('/', protect, async (req, res) => {
  try {
    const doc = await Document.create({
      title: req.body.title || 'Untitled Document',
      owner: req.user.id,
      activityLog: [{ user: req.user.name, action: 'created the document' }],
    });
    res.status(201).json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Could not create document', error: err.message });
  }
});

// GET /api/documents/:id
// Fetch one document's full content (used when opening the editor).
// We also send back the caller's role, so the frontend knows whether to
// show the editor as read-only.
router.get('/:id', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const role = doc.getRoleFor(req.user.id);
    if (!role) return res.status(403).json({ message: 'You do not have access to this document' });

    res.json({ ...doc.toObject(), myRole: role });
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch document', error: err.message });
  }
});

// PATCH /api/documents/:id/title
// Renames a document. Anyone with editor/owner access can rename;
// viewers cannot.
router.patch('/:id/title', protect, async (req, res) => {
  try {
    const { title } = req.body;
    if (!title || !title.trim()) return res.status(400).json({ message: 'Title cannot be empty' });

    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const role = doc.getRoleFor(req.user.id);
    if (role !== 'owner' && role !== 'editor') {
      return res.status(403).json({ message: 'You do not have permission to rename this document' });
    }

    doc.title = title.trim();
    doc.activityLog.push({ user: req.user.name, action: `renamed the document to "${doc.title}"` });
    await doc.save();

    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Could not rename document', error: err.message });
  }
});

// DELETE /api/documents/:id
// Only the OWNER can delete a document (not editors or viewers).
router.delete('/:id', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    if (doc.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the owner can delete this document' });
    }

    await Document.findByIdAndDelete(req.params.id);
    await Revision.deleteMany({ document: req.params.id }); // clean up its history too

    res.json({ message: 'Document deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Could not delete document', error: err.message });
  }
});

// POST /api/documents/:id/invite
// Adds another registered user (by email) as a collaborator, with a
// chosen role: 'editor' (can type) or 'viewer' (read-only).
router.post('/:id/invite', protect, async (req, res) => {
  try {
    const { email, role } = req.body;
    const chosenRole = role === 'viewer' ? 'viewer' : 'editor'; // default to editor

    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    if (doc.owner.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Only the owner can invite collaborators' });
    }

    const userToAdd = await User.findOne({ email });
    if (!userToAdd) return res.status(404).json({ message: 'No user found with that email' });

    const already = doc.collaborators.find((c) => c.user.toString() === userToAdd._id.toString());
    if (already) {
      already.role = chosenRole; // already invited — just update their role
    } else {
      doc.collaborators.push({ user: userToAdd._id, role: chosenRole });
    }

    doc.activityLog.push({ user: req.user.name, action: `invited ${userToAdd.name} as ${chosenRole}` });
    await doc.save();

    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Could not invite collaborator', error: err.message });
  }
});

// GET /api/documents/:id/revisions
// Returns the saved version history (newest first), for the "Version
// History" bonus feature. We only send metadata + content, not huge extras.
router.get('/:id/revisions', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    if (!doc.getRoleFor(req.user.id)) return res.status(403).json({ message: 'No access' });

    const revisions = await Revision.find({ document: req.params.id })
      .sort({ version: -1 })
      .limit(30); // cap it so history doesn't grow unbounded in the response

    res.json(revisions);
  } catch (err) {
    res.status(500).json({ message: 'Could not fetch revisions', error: err.message });
  }
});

// POST /api/documents/:id/revisions/:revisionId/restore
// Rolls the document's content back to an older saved version.
// This itself counts as a NEW edit (bumps the version forward, doesn't
// rewrite history), same idea as "revert" in Git.
router.post('/:id/revisions/:revisionId/restore', protect, async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const role = doc.getRoleFor(req.user.id);
    if (role !== 'owner' && role !== 'editor') {
      return res.status(403).json({ message: 'You do not have permission to restore versions' });
    }

    const revision = await Revision.findById(req.params.revisionId);
    if (!revision) return res.status(404).json({ message: 'Revision not found' });

    // Save the CURRENT state as a revision too, before overwriting, so
    // restoring is never destructive — you can always undo the undo.
    await Revision.create({
      document: doc._id,
      content: doc.content,
      version: doc.version,
      editedBy: req.user.name,
    });

    doc.content = revision.content;
    doc.version += 1;
    doc.activityLog.push({ user: req.user.name, action: `restored version ${revision.version}` });
    await doc.save();

    res.json(doc);
  } catch (err) {
    res.status(500).json({ message: 'Could not restore revision', error: err.message });
  }
});

module.exports = router;
