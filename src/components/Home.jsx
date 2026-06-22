import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../firebase';
import NavBar from './NavBar';
import { LogOut, Mic, Search, X } from 'lucide-react';

function groupByDate(memos) {
  const groups = {};
  memos.forEach((memo) => {
    if (!memo.createdAt) return;
    const dateKey = memo.createdAt.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(memo);
  });
  return groups;
}

function getDateLabel(dateStr) {
  const fmt = (d) =>
    d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
  const today = fmt(new Date());
  const yesterday = fmt(new Date(Date.now() - 86400000));
  if (dateStr === today) return `오늘 · ${dateStr}`;
  if (dateStr === yesterday) return `어제 · ${dateStr}`;
  return dateStr;
}

function formatTime(date) {
  if (!date) return '';
  return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
}

export default function Home() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memos, setMemos] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTag, setSelectedTag] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setLoading(false);
      } else {
        navigate('/');
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'memos'),
      where('uid', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate() ?? null,
      }));
      setMemos(list);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/');
    } catch {
      alert('로그아웃에 실패했습니다. 다시 시도해주세요.');
    }
  };

  const allTags = [...new Set(memos.flatMap((m) => m.tags ?? []))];

  const filtered = memos.filter((m) => {
    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q || m.summary?.toLowerCase().includes(q) || m.originalText?.toLowerCase().includes(q);
    const matchTag = !selectedTag || (m.tags ?? []).includes(selectedTag);
    return matchSearch && matchTag;
  });

  const grouped = groupByDate(filtered);

  if (loading) {
    return (
      <div style={s.loadingContainer}>
        <p style={{ color: '#6B7280', fontSize: '16px' }}>로딩 중...</p>
      </div>
    );
  }

  return (
    <div style={s.container}>
      {/* 헤더 */}
      <div style={s.header}>
        <h1 style={s.title}>Voice Memo</h1>
        <div style={s.userInfo}>
          {user?.photoURL && <img src={user.photoURL} alt="" style={s.avatar} />}
          <div>
            <p style={s.userName}>{user?.displayName || '사용자'}</p>
            <p style={s.userEmail}>{user?.email}</p>
          </div>
          <button style={s.logoutBtn} onClick={handleLogout}>
            <LogOut size={16} />
            로그아웃
          </button>
        </div>
      </div>

      <div style={s.content}>
        {/* 검색 바 */}
        <div style={s.searchWrapper}>
          <Search size={16} color="#9CA3AF" style={{ flexShrink: 0 }} />
          <input
            style={s.searchInput}
            type="text"
            placeholder="메모 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button style={s.clearBtn} onClick={() => setSearchQuery('')}>
              <X size={14} />
            </button>
          )}
        </div>

        {/* 태그 필터 */}
        {allTags.length > 0 && (
          <div style={s.tagRow}>
            <button
              style={selectedTag === null ? s.tagFilterActive : s.tagFilter}
              onClick={() => setSelectedTag(null)}
            >
              전체
            </button>
            {allTags.map((tag) => (
              <button
                key={tag}
                style={selectedTag === tag ? s.tagFilterActive : s.tagFilter}
                onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* 메모 목록 */}
        {memos.length === 0 ? (
          <div style={s.emptyCard}>
            <div style={{ fontSize: '56px', marginBottom: '16px' }}>🎙️</div>
            <h2 style={s.emptyTitle}>안녕하세요, {user?.displayName || '사용자'}님!</h2>
            <p style={s.emptyText}>
              아직 저장된 메모가 없습니다.<br />
              마이크 버튼을 눌러 첫 번째 음성 메모를 시작해보세요.
            </p>
            <button style={s.startBtn} onClick={() => navigate('/record')}>
              🎙️ 메모 시작하기
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div style={s.emptyCard}>
            <p style={{ color: '#6B7280', fontSize: '15px' }}>검색 결과가 없습니다.</p>
          </div>
        ) : (
          Object.entries(grouped).map(([dateStr, dateMemos]) => (
            <div key={dateStr} style={s.dateGroup}>
              <p style={s.dateLabel}>{getDateLabel(dateStr)}</p>
              {dateMemos.map((memo) => (
                <div key={memo.id} style={s.memoCard} onClick={() => alert('메모 상세 화면 (준비중)')}>
                  <div style={s.cardTop}>
                    {memo.category && <span style={s.categoryBadge}>{memo.category}</span>}
                    <span style={s.timeText}>{formatTime(memo.createdAt)}</span>
                  </div>
                  <p style={s.summaryText}>{memo.summary || memo.originalText?.slice(0, 60)}</p>
                  {(memo.tags ?? []).length > 0 && (
                    <div style={s.tagList}>
                      {memo.tags.map((tag) => (
                        <span key={tag} style={s.tagChip}>#{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))
        )}
      </div>

      {/* 플로팅 녹음 버튼 */}
      <button
        style={s.fab}
        onClick={() => navigate('/record')}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.1)';
          e.currentTarget.style.boxShadow = '0 8px 30px rgba(124,58,237,0.6)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1)';
          e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,58,237,0.4)';
        }}
        title="새 메모 녹음"
      >
        <Mic size={28} color="#fff" />
      </button>

      <NavBar />
    </div>
  );
}

const s = {
  loadingContainer: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f9fafb',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
  container: {
    minHeight: '100vh',
    background: '#f9fafb',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif',
    paddingBottom: '120px',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 20px',
    background: '#fff',
    borderBottom: '1px solid #F3F4F6',
    position: 'sticky',
    top: 0,
    zIndex: 10,
  },
  title: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#4C1D95',
    margin: 0,
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  avatar: {
    width: '36px',
    height: '36px',
    borderRadius: '50%',
    border: '2px solid #7C3AED',
    objectFit: 'cover',
  },
  userName: {
    fontSize: '13px',
    fontWeight: '500',
    color: '#374151',
    margin: 0,
  },
  userEmail: {
    fontSize: '11px',
    color: '#9CA3AF',
    margin: 0,
  },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 12px',
    borderRadius: '8px',
    border: 'none',
    background: '#FEE2E2',
    color: '#DC2626',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  content: {
    maxWidth: '720px',
    margin: '0 auto',
    padding: '16px 16px',
  },
  searchWrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: '#fff',
    border: '1px solid #E5E7EB',
    borderRadius: '12px',
    padding: '10px 14px',
    marginBottom: '12px',
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    fontSize: '14px',
    color: '#1F2937',
    background: 'transparent',
  },
  clearBtn: {
    display: 'flex',
    alignItems: 'center',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    color: '#9CA3AF',
    padding: 0,
  },
  tagRow: {
    display: 'flex',
    gap: '8px',
    flexWrap: 'wrap',
    marginBottom: '16px',
  },
  tagFilter: {
    padding: '5px 12px',
    borderRadius: '20px',
    border: '1px solid #E5E7EB',
    background: '#fff',
    color: '#6B7280',
    fontSize: '12px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  tagFilterActive: {
    padding: '5px 12px',
    borderRadius: '20px',
    border: '1px solid #7C3AED',
    background: '#EDE9FE',
    color: '#7C3AED',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  emptyCard: {
    background: '#fff',
    borderRadius: '16px',
    padding: '48px 32px',
    textAlign: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    marginTop: '16px',
  },
  emptyTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1F2937',
    margin: '0 0 8px',
  },
  emptyText: {
    fontSize: '14px',
    color: '#6B7280',
    lineHeight: 1.6,
    margin: '0 0 24px',
  },
  startBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 24px',
    borderRadius: '12px',
    border: 'none',
    background: '#7C3AED',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  dateGroup: {
    marginBottom: '24px',
  },
  dateLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: '0 0 8px 4px',
  },
  memoCard: {
    background: '#fff',
    borderRadius: '12px',
    padding: '16px',
    marginBottom: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s',
  },
  cardTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  categoryBadge: {
    padding: '2px 10px',
    borderRadius: '20px',
    background: '#DBEAFE',
    color: '#1D4ED8',
    fontSize: '11px',
    fontWeight: '600',
  },
  timeText: {
    fontSize: '11px',
    color: '#9CA3AF',
  },
  summaryText: {
    fontSize: '14px',
    color: '#1F2937',
    lineHeight: 1.5,
    margin: '0 0 10px',
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
  tagList: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px',
  },
  tagChip: {
    padding: '3px 10px',
    borderRadius: '20px',
    background: '#E9D5FF',
    color: '#6B21A8',
    fontSize: '11px',
    fontWeight: '500',
  },
  fab: {
    position: 'fixed',
    bottom: '88px',
    right: '24px',
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(124,58,237,0.4)',
    transition: 'all 0.2s ease',
  },
};
