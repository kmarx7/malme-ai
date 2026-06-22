import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Search, X, Edit2, Trash2 } from 'lucide-react';

const CATEGORIES = ['회의', '할일', '아이디어', '일반'];

const getCategoryColor = (category) => {
  const colors = {
    '회의': { bg: '#DBEAFE', text: '#1D4ED8' },
    '할일': { bg: '#DCFCE7', text: '#166534' },
    '아이디어': { bg: '#FEF3C7', text: '#B45309' },
    '일반': { bg: '#E5E7EB', text: '#374151' },
  };
  return colors[category] || colors['일반'];
};

function formatDate(date) {
  if (!date) return '';
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function MemoCard({ memo, onClick }) {
  const categoryColor = getCategoryColor(memo.category);

  return (
    <div style={s.card} onClick={onClick}>
      <div style={s.cardHeader}>
        {memo.category && (
          <span style={{ ...s.categoryBadge, ...categoryColor }}>
            {memo.category}
          </span>
        )}
        <span style={s.timeText}>{formatDate(memo.createdAt)}</span>
      </div>
      <p style={s.summaryText}>{memo.summary || memo.originalText?.slice(0, 100)}</p>
      {(memo.tags ?? []).length > 0 && (
        <div style={s.tagList}>
          {memo.tags.map((tag) => (
            <span key={tag} style={s.tagChip}>#{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}

function MemoModal({ memo, onClose, onSave, onDelete }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({
    summary: memo.summary,
    tags: (memo.tags ?? []).join(', '),
    category: memo.category,
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const tags = editData.tags
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      await onSave({
        summary: editData.summary,
        tags,
        category: editData.category,
      });
      setIsEditing(false);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (window.confirm('이 메모를 삭제하시겠습니까?')) {
      setIsDeleting(true);
      try {
        await onDelete();
        onClose();
      } finally {
        setIsDeleting(false);
      }
    }
  };

  const categoryColor = getCategoryColor(editData.category);

  return (
    <div style={s.modalOverlay} onClick={onClose}>
      <div style={s.modal} onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div style={s.modalHeader}>
          <div style={s.modalHeaderTop}>
            {editData.category && (
              <span style={{ ...s.categoryBadge, ...categoryColor }}>
                {editData.category}
              </span>
            )}
            <button style={s.closeBtn} onClick={onClose}>
              <X size={20} />
            </button>
          </div>
          <p style={s.modalDate}>{formatDate(memo.createdAt)}</p>
        </div>

        {/* 원문 */}
        <div style={s.modalSection}>
          <h3 style={s.sectionTitle}>원문</h3>
          <div style={s.originalTextBox}>{memo.originalText}</div>
        </div>

        {/* 편집 모드 */}
        {isEditing ? (
          <div style={s.modalSection}>
            <h3 style={s.sectionTitle}>메모 편집</h3>

            <div style={s.editField}>
              <label style={s.label}>요약</label>
              <textarea
                style={s.textarea}
                value={editData.summary}
                onChange={(e) => setEditData({ ...editData, summary: e.target.value })}
                placeholder="메모 요약을 입력하세요..."
              />
            </div>

            <div style={s.editField}>
              <label style={s.label}>태그 (쉼표로 구분)</label>
              <input
                style={s.input}
                type="text"
                value={editData.tags}
                onChange={(e) => setEditData({ ...editData, tags: e.target.value })}
                placeholder="예: 회의, 중요"
              />
            </div>

            <div style={s.editField}>
              <label style={s.label}>카테고리</label>
              <select
                style={s.select}
                value={editData.category}
                onChange={(e) => setEditData({ ...editData, category: e.target.value })}
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div style={s.buttonGroup}>
              <button style={s.btnPrimary} onClick={handleSave} disabled={isSaving}>
                {isSaving ? '저장 중...' : '저장'}
              </button>
              <button style={s.btnSecondary} onClick={() => setIsEditing(false)}>
                취소
              </button>
            </div>
          </div>
        ) : (
          <div style={s.modalSection}>
            <h3 style={s.sectionTitle}>AI 요약</h3>
            <p style={s.summaryDisplay}>{editData.summary || '(요약 없음)'}</p>

            {editData.tags && editData.tags.length > 0 && (
              <div>
                <h3 style={s.sectionTitle}>태그</h3>
                <div style={s.tagList}>
                  {editData.tags.split(',').map((tag) => (
                    <span key={tag} style={s.tagChip}>{tag.trim()}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 액션 버튼 */}
        {!isEditing && (
          <div style={s.actionButtons}>
            <button style={s.iconBtn} onClick={() => setIsEditing(true)} title="편집">
              <Edit2 size={16} />
              편집
            </button>
            <button
              style={{ ...s.iconBtn, color: '#DC2626' }}
              onClick={handleDelete}
              disabled={isDeleting}
              title="삭제"
            >
              <Trash2 size={16} />
              {isDeleting ? '삭제 중...' : '삭제'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MemoList() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [memos, setMemos] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [selectedTags, setSelectedTags] = useState(new Set());
  const [selectedMemo, setSelectedMemo] = useState(null);

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

  // 고유 카테고리 추출
  const allCategories = ['전체', ...new Set(memos.map((m) => m.category).filter(Boolean))];

  // 고유 태그 추출
  const allTags = [...new Set(memos.flatMap((m) => m.tags ?? []))];

  // 필터링
  const filtered = memos.filter((m) => {
    const q = searchQuery.trim().toLowerCase();
    const matchSearch =
      !q ||
      m.summary?.toLowerCase().includes(q) ||
      m.originalText?.toLowerCase().includes(q);
    const matchCategory =
      !selectedCategory || selectedCategory === '전체' || m.category === selectedCategory;
    const matchTags =
      selectedTags.size === 0 ||
      (m.tags ?? []).some((tag) => selectedTags.has(tag));

    return matchSearch && matchCategory && matchTags;
  });

  const handleSaveMemo = async (memoId, updates) => {
    try {
      await updateDoc(doc(db, 'memos', memoId), updates);
    } catch (error) {
      console.error('메모 저장 실패:', error);
      alert('메모 저장에 실패했습니다.');
    }
  };

  const handleDeleteMemo = async (memoId) => {
    try {
      await deleteDoc(doc(db, 'memos', memoId));
    } catch (error) {
      console.error('메모 삭제 실패:', error);
      alert('메모 삭제에 실패했습니다.');
    }
  };

  const toggleTag = (tag) => {
    const newTags = new Set(selectedTags);
    if (newTags.has(tag)) {
      newTags.delete(tag);
    } else {
      newTags.add(tag);
    }
    setSelectedTags(newTags);
  };

  if (loading) {
    return (
      <div style={s.loadingContainer}>
        <p style={{ color: '#6B7280', fontSize: '16px' }}>로딩 중...</p>
      </div>
    );
  }

  return (
    <div style={s.container}>
      <style>{`
        @media (max-width: 640px) {
          [data-grid] {
            grid-template-columns: 1fr;
          }
        }
        @media (min-width: 641px) and (max-width: 1023px) {
          [data-grid] {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (min-width: 1024px) {
          [data-grid] {
            grid-template-columns: repeat(3, 1fr);
          }
        }
      `}</style>

      {/* 헤더 */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>내 메모 목록</h1>
          <p style={s.badge}>{filtered.length}개</p>
        </div>
      </div>

      <div style={s.content}>
        {/* 검색창 */}
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

        {/* 카테고리 필터 탭 */}
        {allCategories.length > 0 && (
          <div style={s.filterTabs}>
            {allCategories.map((cat) => (
              <button
                key={cat}
                style={
                  selectedCategory === cat || (cat === '전체' && !selectedCategory)
                    ? s.tabActive
                    : s.tab
                }
                onClick={() =>
                  setSelectedCategory(cat === '전체' ? null : cat)
                }
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* 태그 필터 */}
        {allTags.length > 0 && (
          <div style={s.tagFilters}>
            {allTags.map((tag) => (
              <button
                key={tag}
                style={
                  selectedTags.has(tag)
                    ? s.tagFilterActive
                    : s.tagFilter
                }
                onClick={() => toggleTag(tag)}
              >
                #{tag}
              </button>
            ))}
          </div>
        )}

        {/* 메모 그리드 */}
        {filtered.length === 0 ? (
          <div style={s.emptyState}>
            <p style={s.emptyText}>
              {memos.length === 0
                ? '아직 메모가 없습니다.\n녹음 버튼을 눌러 첫 메모를 시작해보세요.'
                : '검색 결과가 없습니다.'}
            </p>
          </div>
        ) : (
          <div style={s.grid} data-grid>
            {filtered.map((memo) => (
              <MemoCard
                key={memo.id}
                memo={memo}
                onClick={() => setSelectedMemo(memo)}
              />
            ))}
          </div>
        )}
      </div>

      {/* 상세 모달 */}
      {selectedMemo && (
        <MemoModal
          memo={selectedMemo}
          onClose={() => setSelectedMemo(null)}
          onSave={(updates) =>
            handleSaveMemo(selectedMemo.id, updates)
          }
          onDelete={() =>
            handleDeleteMemo(selectedMemo.id)
          }
        />
      )}
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
    paddingBottom: '100px',
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
  badge: {
    fontSize: '12px',
    color: '#9CA3AF',
    margin: '4px 0 0',
  },
  content: {
    maxWidth: '1200px',
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
    marginBottom: '16px',
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
  filterTabs: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    flexWrap: 'wrap',
  },
  tab: {
    padding: '8px 14px',
    borderRadius: '20px',
    border: '1px solid #E5E7EB',
    background: '#fff',
    color: '#6B7280',
    fontSize: '13px',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  tabActive: {
    padding: '8px 14px',
    borderRadius: '20px',
    border: '1px solid #7C3AED',
    background: '#EDE9FE',
    color: '#7C3AED',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
  },
  tagFilters: {
    display: 'flex',
    gap: '8px',
    marginBottom: '16px',
    flexWrap: 'wrap',
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
    transition: 'all 0.2s',
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
  grid: {
    display: 'grid',
    gap: '16px',
  },
  card: {
    background: '#fff',
    borderRadius: '12px',
    padding: '16px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    cursor: 'pointer',
    transition: 'box-shadow 0.2s, transform 0.2s',
  },
  cardHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '12px',
  },
  categoryBadge: {
    padding: '4px 12px',
    borderRadius: '20px',
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
  emptyState: {
    background: '#fff',
    borderRadius: '16px',
    padding: '48px 32px',
    textAlign: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.06)',
    marginTop: '16px',
  },
  emptyText: {
    fontSize: '14px',
    color: '#6B7280',
    whiteSpace: 'pre-line',
    margin: 0,
  },

  // 모달 스타일
  modalOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: 'rgba(0,0,0,0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    background: '#fff',
    borderRadius: '16px',
    maxWidth: '520px',
    maxHeight: '90vh',
    overflow: 'auto',
    boxShadow: '0 20px 25px rgba(0,0,0,0.15)',
  },
  modalHeader: {
    padding: '20px 20px 16px',
    borderBottom: '1px solid #F3F4F6',
    position: 'sticky',
    top: 0,
    background: '#fff',
  },
  modalHeaderTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '8px',
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: '#9CA3AF',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalDate: {
    fontSize: '12px',
    color: '#9CA3AF',
    margin: 0,
  },
  modalSection: {
    padding: '20px',
    borderBottom: '1px solid #F3F4F6',
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    margin: '0 0 12px',
  },
  originalTextBox: {
    background: '#F9FAFB',
    border: '1px solid #E5E7EB',
    borderRadius: '8px',
    padding: '12px',
    fontSize: '14px',
    color: '#1F2937',
    lineHeight: 1.6,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  summaryDisplay: {
    fontSize: '14px',
    color: '#1F2937',
    lineHeight: 1.6,
    margin: 0,
  },
  editField: {
    marginBottom: '16px',
  },
  label: {
    display: 'block',
    fontSize: '13px',
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: '6px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    color: '#1F2937',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
  },
  textarea: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    color: '#1F2937',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    minHeight: '100px',
    resize: 'vertical',
  },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    fontSize: '14px',
    color: '#1F2937',
    boxSizing: 'border-box',
    fontFamily: 'inherit',
    background: '#fff',
    cursor: 'pointer',
  },
  buttonGroup: {
    display: 'flex',
    gap: '8px',
  },
  btnPrimary: {
    flex: 1,
    padding: '12px',
    borderRadius: '8px',
    border: 'none',
    background: '#7C3AED',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background 0.2s',
  },
  btnSecondary: {
    flex: 1,
    padding: '12px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    background: '#fff',
    color: '#6B7280',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  actionButtons: {
    display: 'flex',
    gap: '8px',
    padding: '16px 20px',
    borderTop: '1px solid #F3F4F6',
  },
  iconBtn: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    padding: '10px',
    borderRadius: '8px',
    border: '1px solid #E5E7EB',
    background: '#fff',
    color: '#1F2937',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
};
