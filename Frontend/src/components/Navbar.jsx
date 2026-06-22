import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Navbar() {
  const { isLoggedIn, user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <nav className="bg-gray-900 border-b border-gray-700 px-6 py-3 flex items-center justify-between">
      <Link to="/" className="text-white font-bold text-xl tracking-tight">
        🔍 SatyaScan
      </Link>
      <div className="flex items-center gap-4 text-sm">
        <Link to="/analyze" className="text-gray-300 hover:text-white transition">Analyze</Link>
        {isLoggedIn && (
          <Link to="/history" className="text-gray-300 hover:text-white transition">History</Link>
        )}
        {isLoggedIn ? (
          <>
            <span className="text-gray-400">Hi, {user?.name}</span>
            <button
              onClick={handleLogout}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded transition"
            >
              Logout
            </button>
          </>
        ) : (
          <>
            <Link to="/login" className="text-gray-300 hover:text-white transition">Login</Link>
            <Link
              to="/signup"
              className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded transition"
            >
              Sign Up
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
