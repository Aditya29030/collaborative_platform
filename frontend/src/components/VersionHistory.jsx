// src/components/VersionHistory.jsx
// Slide-out panel listing past saved versions of the document, with a
// button to restore any of them. This is the "Version History" bonus
// feature, backed by the Revision model on the server.

import { useEffect, useState } from 'react';
import api from '../utils/api';

export default function VersionHistory({ documentId, onClose, onRestored }) {
  const [revisions, setRevisions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [restoringId, setRestoringId] = useState(null);

  useEffect(() => {
    api
      .get(`/documents/${documentId}/revisions`)
      .then(({ data }) => setRevisions(data))
      .finally(() => setLoading(false));
  }, [documentId]);

  const handleRestore = async (revisionId) => {
    setRestoringId(revisionId);
    try {
      const { data } = await api.post(`/documents/${documentId}/revisions/${revisionId}/restore`);
      onRestored(data); // tell the Editor to update its textarea with the restored content
      onClose();
    } catch (err) {
      alert(err.response?.data?.message || 'Could not restore this version');
    } finally {
      setRestoringId(null);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-end z-50">
      <div className="bg-white h-full w-full max-w-sm shadow-xl p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg">Version history</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        {loading && <p className="text-sm text-slate-500">Loading...</p>}
        {!loading && revisions.length === 0 && (
          <p className="text-sm text-slate-500">No earlier versions yet — keep editing to build history.</p>
        )}

        <ul className="space-y-3">
          {revisions.map((rev) => (
            <li key={rev._id} className="border rounded p-3">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <p className="text-sm font-medium">Version {rev.version}</p>
                  <p className="text-xs text-slate-400">
                    {rev.editedBy} · {new Date(rev.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => handleRestore(rev._id)}
                  disabled={restoringId === rev._id}
                  className="text-xs bg-brand hover:bg-brand-dark text-white px-2 py-1 rounded transition"
                >
                  {restoringId === rev._id ? 'Restoring...' : 'Restore'}
                </button>
              </div>
              <p className="text-xs text-slate-500 line-clamp-2 whitespace-pre-wrap break-words">
                {rev.content ? rev.content.slice(0, 120) : '(empty)'}
              </p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
