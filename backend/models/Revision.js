// models/Revision.js
// Every time an edit is accepted (see sockets/collabHandler.js), we save a
// snapshot here BEFORE overwriting the document. This gives us a full
// history you can browse and restore — like Google Docs' "Version history".
//
// We keep this as a SEPARATE collection from Document (rather than an array
// inside it) because revision history can grow large and we rarely need it
// loaded — only when the user explicitly opens the history panel.

const mongoose = require('mongoose');

const revisionSchema = new mongoose.Schema({
  document: { type: mongoose.Schema.Types.ObjectId, ref: 'Document', required: true, index: true },
  content: { type: String, required: true },
  version: { type: Number, required: true },
  editedBy: { type: String, required: true }, // name, just for display
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Revision', revisionSchema);
