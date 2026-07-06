// src/pages/Dashboard.jsx
// Lists all documents the user owns or collaborates on, and lets them
// create, rename, or delete documents.

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import Navbar from '../components/Navbar.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [renamingId, setRenamingId] = useState(null);
  const [renameDraft, setRenameDraft] = useState('');
  const navigate = useNavigate();
  const { user } = useAuth();

  const loadDocs = () => {
    api
      .get('/documents')
      .then(({ data }) => setDocs(data))
      .catch((err) => console.error('Failed to load documents:', err))
      .finally(() => setLoading(false));
  };

  useEffect(loadDocs, []);

  const createDocument = async () => {
    const { data } = await api.post('/documents', { title: 'Untitled Document' });
    navigate(`/documents/${data._id}`); // jump straight into the new document
  };

  const startRename = (doc, e) => {
    e.stopPropagation(); // don't also trigger the row's "open document" click
    setRenamingId(doc._id);
    setRenameDraft(doc.title);
  };

  const confirmRename = async (docId, e) => {
    e.stopPropagation();
    const trimmed = renameDraft.trim();
    if (trimmed) {
      await api.patch(`/documents/${docId}/title`, { title: trimmed });
      setDocs((prev) => prev.map((d) => (d._id === docId ? { ...d, title: trimmed } : d)));
    }
    setRenamingId(null);
  };

  const deleteDocument = async (docId, e) => {
    e.stopPropagation();
    if (!confirm('Delete this document? This cannot be undone.')) return;
    await api.delete(`/documents/${docId}`);
    setDocs((prev) => prev.filter((d) => d._id !== docId));
  };

  // Figures out "Owner" / "Editor" / "Viewer" badge text for a doc row.
  const roleLabel = (doc) => {
    if (doc.owner === user.id) return 'Owner';
    const collab = doc.collaborators?.find((c) => c.user === user.id);
    return collab?.role === 'viewer' ? 'Viewer' : 'Editor';
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-xl font-semibold">Your Documents</h1>
          <button
            onClick={createDocument}
            className="bg-brand hover:bg-brand-dark text-white text-sm font-medium px-4 py-2 rounded transition"
          >
            + New Document
          </button>
        </div>

        {loading && <p className="text-slate-500">Loading...</p>}

        {!loading && docs.length === 0 && (
          <p className="text-slate-500">No documents yet — create your first one above.</p>
        )}

        <ul className="space-y-2">
          {docs.map((doc) => (
            <li
              key={doc._id}
              onClick={() => renamingId !== doc._id && navigate(`/documents/${doc._id}`)}
              className="bg-white border rounded p-4 cursor-pointer hover:border-brand transition flex justify-between items-center gap-3"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                {renamingId === doc._id ? (
                  <input
                    autoFocus
                    value={renameDraft}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => setRenameDraft(e.target.value)}
                    onBlur={(e) => confirmRename(doc._id, e)}
                    onKeyDown={(e) => e.key === 'Enter' && confirmRename(doc._id, e)}
                    className="border-b border-brand focus:outline-none text-sm font-medium flex-1 min-w-0"
                  />
                ) : (
                  <span className="font-medium truncate">{doc.title}</span>
                )}
                <span className="text-[10px] uppercase tracking-wide bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded shrink-0">
                  {roleLabel(doc)}
                </span>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-slate-400 hidden sm:inline">
                  Updated {new Date(doc.updatedAt).toLocaleDateString()}
                </span>
                {doc.owner === user.id && (
                  <>
                    <button
                      onClick={(e) => startRename(doc, e)}
                      className="text-xs text-slate-400 hover:text-brand"
                      title="Rename"
                    >
                      Rename
                    </button>
                    <button
                      onClick={(e) => deleteDocument(doc._id, e)}
                      className="text-xs text-slate-400 hover:text-red-600"
                      title="Delete"
                    >
                      Delete
                    </button>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
