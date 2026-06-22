import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signInWithPopup, onAuthStateChanged } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { Mic } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 인증 상태 감지 - 이미 로그인된 경우 홈으로 리다이렉트
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate('/home');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  // Firebase 에러 메시지 한국어로 변환
  const getKoreanErrorMessage = (errorCode) => {
    const errorMessages = {
      'auth/popup-closed-by-user': '로그인 창이 닫혔습니다. 다시 시도해주세요.',
      'auth/cancelled-popup-request': '로그인이 취소되었습니다.',
      'auth/network-request-failed': '네트워크 오류입니다. 인터넷 연결을 확인해주세요.',
      'auth/operation-not-allowed': 'Google 로그인이 현재 사용 불가능합니다.',
      'auth/too-many-requests': '너무 많은 시도가 있었습니다. 잠시 후 다시 시도해주세요.',
    };
    return errorMessages[errorCode] || '로그인에 실패했습니다. 다시 시도해주세요.';
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      await signInWithPopup(auth, googleProvider);
      // 로그인 성공 후 onAuthStateChanged에서 자동으로 /home으로 이동
    } catch (err) {
      setError(getKoreanErrorMessage(err.code));
      console.error('Login error:', err);
    } finally {
      setLoading(false);
    }
  };

  const styles = {
    container: {
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)',
      padding: '20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", sans-serif',
    },
    card: {
      background: '#ffffff',
      borderRadius: '24px',
      padding: '48px 32px',
      maxWidth: '400px',
      width: '100%',
      boxShadow: '0 20px 60px rgba(0, 0, 0, 0.15)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '24px',
    },
    iconWrapper: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      width: '80px',
      height: '80px',
      borderRadius: '50%',
      background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
      marginBottom: '8px',
    },
    icon: {
      width: '48px',
      height: '48px',
      color: '#ffffff',
    },
    title: {
      fontSize: '28px',
      fontWeight: '700',
      color: '#4C1D95',
      margin: '0',
      textAlign: 'center',
      lineHeight: '1.2',
    },
    subtitle: {
      fontSize: '16px',
      color: '#6B7280',
      margin: '0',
      textAlign: 'center',
      lineHeight: '1.5',
      fontWeight: '400',
    },
    buttonContainer: {
      width: '100%',
      marginTop: '16px',
    },
    button: {
      width: '100%',
      padding: '14px 24px',
      borderRadius: '12px',
      border: 'none',
      background: '#7C3AED',
      color: '#ffffff',
      fontSize: '16px',
      fontWeight: '600',
      cursor: loading ? 'not-allowed' : 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: '12px',
      transition: 'background-color 0.3s ease',
      opacity: loading ? 0.8 : 1,
    },
    buttonHover: {
      background: '#6D28D9',
    },
    googleIcon: {
      width: '20px',
      height: '20px',
    },
    errorMessage: {
      color: '#DC2626',
      fontSize: '14px',
      textAlign: 'center',
      padding: '12px',
      background: '#FEE2E2',
      borderRadius: '8px',
      marginBottom: '8px',
      lineHeight: '1.5',
    },
    footerText: {
      fontSize: '12px',
      color: '#9CA3AF',
      textAlign: 'center',
      lineHeight: '1.4',
      marginTop: '12px',
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* 로고 */}
        <div style={styles.iconWrapper}>
          <Mic style={styles.icon} strokeWidth={1.5} />
        </div>

        {/* 앱 이름 */}
        <h1 style={styles.title}>Voice Memo</h1>

        {/* 서브타이틀 */}
        <p style={styles.subtitle}>음성으로 말하기만 하면,<br />AI가 알아서 정리해줘요</p>

        {/* 에러 메시지 */}
        {error && <div style={styles.errorMessage}>{error}</div>}

        {/* Google 로그인 버튼 */}
        <div style={styles.buttonContainer}>
          <button
            style={styles.button}
            onMouseEnter={(e) => (e.target.style.background = styles.buttonHover.background)}
            onMouseLeave={(e) => (e.target.style.background = styles.button.background)}
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <svg
              style={styles.googleIcon}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="1" />
              <path d="M12 1v6M12 17v6M1 12h6M17 12h6" />
            </svg>
            {loading ? '로그인 중...' : 'Google로 로그인'}
          </button>
        </div>

        {/* 하단 안내 문구 */}
        <p style={styles.footerText}>
          🎙️ 로그인 후 마이크 권한을 허용하면<br />음성 메모 기능을 사용할 수 있습니다.
        </p>
      </div>
    </div>
  );
}
