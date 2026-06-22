import { useLocation, useNavigate } from 'react-router-dom';
import { Home, List } from 'lucide-react';

export default function NavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <nav style={s.navbar}>
      <button
        style={{
          ...s.navItem,
          ...(isActive('/home') ? s.navItemActive : {}),
        }}
        onClick={() => navigate('/home')}
        title="홈"
      >
        <Home size={24} />
        <span style={s.label}>홈</span>
      </button>

      <button
        style={{
          ...s.navItem,
          ...(isActive('/memos') ? s.navItemActive : {}),
        }}
        onClick={() => navigate('/memos')}
        title="메모"
      >
        <List size={24} />
        <span style={s.label}>메모</span>
      </button>
    </nav>
  );
}

const s = {
  navbar: {
    position: 'fixed',
    bottom: 0,
    left: 0,
    right: 0,
    height: '64px',
    background: '#fff',
    borderTop: '1px solid #E5E7EB',
    display: 'flex',
    justifyContent: 'space-around',
    alignItems: 'center',
    zIndex: 100,
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif',
  },
  navItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '4px',
    flex: 1,
    height: '100%',
    border: 'none',
    background: 'none',
    color: '#9CA3AF',
    cursor: 'pointer',
    transition: 'color 0.2s',
    fontSize: '12px',
    fontWeight: '500',
  },
  navItemActive: {
    color: '#7C3AED',
  },
  label: {
    fontSize: '11px',
  },
};
