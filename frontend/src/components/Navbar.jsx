// src/components/Navbar.jsx
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <nav className="bg-brand-dark text-white px-6 py-4 flex justify-between items-center">
      <span className="font-bold text-lg">Collab Platform</span>
      <div className="flex items-center gap-4">
        <span className="text-sm opacity-90">{user?.name}</span>
        <button
          onClick={handleLogout}
          className="bg-white/10 hover:bg-white/20 text-sm px-3 py-1.5 rounded transition"
        >
          Log out
        </button>
      </div>
    </nav>
  );
}
