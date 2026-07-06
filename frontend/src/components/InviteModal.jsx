// src/components/InviteModal.jsx
// A simple popup: type an email, pick a role, invite. This is what
// "Role-Based Access" needs on the frontend — the owner decides who can
// edit vs who can only view.

import { useState } from 'react';
import api from '../utils/api';

export default function InviteModal({ documentId, onClose }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('editor');
  const [status, setStatus] = useState(''); // '', 'sending', 'sent', 'error'
  const [errorMsg, setErrorMsg] = useState('');

  const handleInvite = async (e) => {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');
    try {
      await api.post(`/documents/${documentId}/invite`, { email, role });
      setStatus('sent');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setErrorMsg(err.response?.data?.message || 'Could not send invite');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-sm p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg">Invite a collaborator</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            ✕
          </button>
        </div>

        <form onSubmit={handleInvite}>
          <label className="block text-sm font-medium mb-1">Their email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@example.com"
            className="w-full border rounded px-3 py-2 mb-4 text-sm focus:outline-none focus:ring-2 focus:ring-brand"
            required
          />

          <label className="block text-sm font-medium mb-1">Access level</label>
          <div className="flex gap-2 mb-4">
            <button
              type="button"
              onClick={() => setRole('editor')}
              className={`flex-1 text-sm py-2 rounded border ${
                role === 'editor' ? 'bg-brand text-white border-brand' : 'border-slate-300 text-slate-600'
              }`}
            >
              Editor — can type
            </button>
            <button
              type="button"
              onClick={() => setRole('viewer')}
              className={`flex-1 text-sm py-2 rounded border ${
                role === 'viewer' ? 'bg-brand text-white border-brand' : 'border-slate-300 text-slate-600'
              }`}
            >
              Viewer — read only
            </button>
          </div>

          {status === 'error' && <p className="text-red-600 text-sm mb-3">{errorMsg}</p>}
          {status === 'sent' && <p className="text-green-600 text-sm mb-3">Invite sent!</p>}

          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full bg-brand hover:bg-brand-dark text-white text-sm font-medium py-2 rounded transition"
          >
            {status === 'sending' ? 'Sending...' : 'Send invite'}
          </button>
        </form>
      </div>
    </div>
  );
}
