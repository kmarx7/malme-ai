import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { transcribeAudio, summarizeMemo } from '../utils/aiProcessor';
import { Mic, Loader, CheckCircle } from 'lucide-react';

const STATES = {
  IDLE: 'idle',
  RECORDING: 'recording',
  TRANSCRIBING: 'transcribing',
  SUMMARIZING: 'summarizing',
  DONE: 'done',
  ERROR: 'error',
};

export default function VoiceRecorder() {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState(STATES.IDLE);
  const [recordingTime, setRecordingTime] = useState(0);
  const [result, setResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const timerIntervalRef = useRef(null);

  // 인증 상태 감지
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

  // 녹음 타이머
  useEffect(() => {
    if (state === STATES.RECORDING) {
      timerIntervalRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }

    return () => {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    };
  }, [state]);

  // 시간 포맷팅 (00:00)
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 녹음 시작
  const handleStartRecording = async () => {
    try {
      setErrorMessage('');
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = 'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // 마이크 해제
        stream.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        // 음성 데이터 처리
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const reader = new FileReader();

        reader.onloadend = async () => {
          const base64Audio = reader.result.split(',')[1]; // data:audio/webm;base64,XXX에서 XXX만 추출
          await processAudio(base64Audio, mimeType);
        };

        reader.onerror = () => {
          setErrorMessage('음성 파일 처리 중 오류가 발생했습니다.');
          setState(STATES.ERROR);
        };

        reader.readAsDataURL(blob);
      };

      mediaRecorder.start();
      setState(STATES.RECORDING);
      setRecordingTime(0);
    } catch (err) {
      console.error('Microphone error:', err);

      if (err.name === 'NotAllowedError') {
        setErrorMessage('마이크 접근 권한이 필요합니다. 브라우저 설정에서 허용해주세요.');
      } else if (err.name === 'NotFoundError') {
        setErrorMessage('마이크를 찾을 수 없습니다. 마이크 기기를 확인해주세요.');
      } else {
        setErrorMessage('마이크 접근 중 오류가 발생했습니다.');
      }

      setState(STATES.ERROR);
    }
  };

  // 녹음 중지
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && state === STATES.RECORDING) {
      mediaRecorderRef.current.stop();
      setState(STATES.TRANSCRIBING);
    }
  };

  // 녹음 취소
  const handleCancelRecording = () => {
    if (mediaRecorderRef.current && state === STATES.RECORDING) {
      mediaRecorderRef.current.stop();
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
      setState(STATES.IDLE);
      setRecordingTime(0);
      chunksRef.current = [];
    }
  };

  // 음성 처리 (전사 → 요약)
  const processAudio = async (base64Audio, mimeType) => {
    try {
      // 1. 음성 전사
      setState(STATES.TRANSCRIBING);
      const transcribedText = await transcribeAudio(base64Audio, mimeType);

      if (!transcribedText || transcribedText.trim().length === 0) {
        throw new Error('음성 인식 결과가 없습니다. 다시 시도해주세요.');
      }

      // 2. 요약 및 태그 추출
      setState(STATES.SUMMARIZING);
      const summarizeResult = await summarizeMemo(transcribedText);

      // 3. 완료
      setResult(summarizeResult);
      setState(STATES.DONE);
    } catch (err) {
      console.error('Audio processing error:', err);
      setErrorMessage(err.message || '처리 중 오류가 발생했습니다. 다시 시도해주세요.');
      setState(STATES.ERROR);
    }
  };

  // 저장 및 홈으로 이동
  const handleSaveAndGoHome = async () => {
    if (!result || !user) return;

    try {
      setState(STATES.SUMMARIZING); // 저장 중 상태

      await addDoc(collection(db, 'memos'), {
        uid: user.uid,
        originalText: result.originalText,
        summary: result.summary,
        tags: result.tags,
        category: result.category,
        createdAt: serverTimestamp(),
      });

      navigate('/home');
    } catch (err) {
      console.error('Save error:', err);
      setErrorMessage('메모 저장 중 오류가 발생했습니다. 다시 시도해주세요.');
      setState(STATES.ERROR);
    }
  };

  // 다시 시도
  const handleRetry = () => {
    setState(STATES.IDLE);
    setRecordingTime(0);
    setErrorMessage('');
    setResult(null);
    chunksRef.current = [];
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loadingContent}>
          <p style={styles.loadingText}>로딩 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* IDLE 상태 */}
        {state === STATES.IDLE && (
          <>
            <button
              style={styles.micButton}
              onClick={handleStartRecording}
              onMouseEnter={(e) => {
                e.target.style.transform = 'scale(1.1)';
                e.target.style.boxShadow = '0 8px 30px rgba(124, 58, 237, 0.6)';
              }}
              onMouseLeave={(e) => {
                e.target.style.transform = 'scale(1)';
                e.target.style.boxShadow = '0 4px 20px rgba(124, 58, 237, 0.5)';
              }}
            >
              <Mic size={48} color="#ffffff" strokeWidth={1.5} />
            </button>
            <h1 style={styles.title}>Voice Memo</h1>
            <p style={styles.subtitle}>마이크 버튼을 눌러<br />음성 메모를 시작하세요</p>
          </>
        )}

        {/* RECORDING 상태 */}
        {state === STATES.RECORDING && (
          <>
            <div style={styles.recordingIndicator}>
              <span style={styles.recordingDot}></span>
              <span style={styles.recordingText}>녹음 중</span>
            </div>
            <p style={styles.recordingTimer}>{formatTime(recordingTime)}</p>
            <div style={styles.buttonGroup}>
              <button style={styles.doneButton} onClick={handleStopRecording}>
                완료
              </button>
              <button style={styles.cancelButton} onClick={handleCancelRecording}>
                취소
              </button>
            </div>
          </>
        )}

        {/* TRANSCRIBING 상태 */}
        {state === STATES.TRANSCRIBING && (
          <>
            <Loader style={styles.spinnerIcon} size={48} color="#7C3AED" />
            <p style={styles.processingText}>음성 변환 중...</p>
          </>
        )}

        {/* SUMMARIZING 상태 */}
        {state === STATES.SUMMARIZING && (
          <>
            <Loader style={styles.spinnerIcon} size={48} color="#7C3AED" />
            <p style={styles.processingText}>AI 정리 중...</p>
          </>
        )}

        {/* DONE 상태 */}
        {state === STATES.DONE && result && (
          <>
            <CheckCircle style={styles.successIcon} size={48} color="#10B981" />
            <h2 style={styles.resultTitle}>메모가 완성되었습니다!</h2>

            <div style={styles.resultPreview}>
              <div style={styles.previewSection}>
                <h3 style={styles.previewLabel}>요약</h3>
                <p style={styles.previewContent}>{result.summary}</p>
              </div>

              <div style={styles.previewSection}>
                <h3 style={styles.previewLabel}>태그</h3>
                <div style={styles.tagContainer}>
                  {result.tags.map((tag, idx) => (
                    <span key={idx} style={styles.tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div style={styles.previewSection}>
                <h3 style={styles.previewLabel}>카테고리</h3>
                <p style={styles.category}>{result.category}</p>
              </div>
            </div>

            <button
              style={styles.saveButton}
              onClick={handleSaveAndGoHome}
              onMouseEnter={(e) => (e.target.style.background = '#6D28D9')}
              onMouseLeave={(e) => (e.target.style.background = '#7C3AED')}
            >
              저장하고 홈으로
            </button>
          </>
        )}

        {/* ERROR 상태 */}
        {state === STATES.ERROR && (
          <>
            <p style={styles.errorTitle}>⚠️ 오류가 발생했습니다</p>
            <p style={styles.errorMessage}>{errorMessage}</p>
            <button
              style={styles.retryButton}
              onClick={handleRetry}
              onMouseEnter={(e) => (e.target.style.background = '#DC2626')}
              onMouseLeave={(e) => (e.target.style.background = '#EF4444')}
            >
              다시 시도
            </button>
          </>
        )}
      </div>
    </div>
  );
}

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
  loadingContent: {
    background: '#ffffff',
    borderRadius: '24px',
    padding: '48px 32px',
    textAlign: 'center',
  },
  loadingText: {
    color: '#6B7280',
    fontSize: '16px',
    margin: '0',
  },

  // IDLE 상태
  micButton: {
    width: '120px',
    height: '120px',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 20px rgba(124, 58, 237, 0.5)',
    transition: 'all 0.3s ease',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#4C1D95',
    margin: '0',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: '16px',
    color: '#6B7280',
    margin: '0',
    textAlign: 'center',
    lineHeight: '1.5',
  },

  // RECORDING 상태
  recordingIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  recordingDot: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
    background: '#EF4444',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  recordingText: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#EF4444',
  },
  recordingTimer: {
    fontSize: '48px',
    fontWeight: '700',
    color: '#1F2937',
    margin: '0',
    fontFamily: 'monospace',
    marginBottom: '24px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    width: '100%',
  },
  doneButton: {
    flex: 1,
    padding: '12px 24px',
    borderRadius: '12px',
    border: 'none',
    background: '#10B981',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
  },
  cancelButton: {
    flex: 1,
    padding: '12px 24px',
    borderRadius: '12px',
    border: '2px solid #EF4444',
    background: '#ffffff',
    color: '#EF4444',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },

  // 로딩 상태
  spinnerIcon: {
    animation: 'spin 1s linear infinite',
  },
  processingText: {
    fontSize: '16px',
    color: '#6B7280',
    margin: '0',
  },

  // DONE 상태
  successIcon: {
    marginBottom: '8px',
  },
  resultTitle: {
    fontSize: '22px',
    fontWeight: '700',
    color: '#1F2937',
    margin: '0 0 24px',
    textAlign: 'center',
  },
  resultPreview: {
    width: '100%',
    background: '#F9FAFB',
    borderRadius: '12px',
    padding: '20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  previewSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  previewLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: '#9CA3AF',
    margin: '0',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  previewContent: {
    fontSize: '14px',
    color: '#374151',
    margin: '0',
    lineHeight: '1.5',
  },
  tagContainer: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '8px',
  },
  tag: {
    display: 'inline-block',
    padding: '4px 12px',
    borderRadius: '16px',
    background: '#E9D5FF',
    color: '#6B21A8',
    fontSize: '12px',
    fontWeight: '500',
  },
  category: {
    fontSize: '14px',
    color: '#374151',
    margin: '0',
    padding: '8px 12px',
    background: '#DBEAFE',
    borderRadius: '6px',
    fontWeight: '500',
  },
  saveButton: {
    width: '100%',
    padding: '12px 24px',
    borderRadius: '12px',
    border: 'none',
    background: '#7C3AED',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
  },

  // ERROR 상태
  errorTitle: {
    fontSize: '18px',
    fontWeight: '600',
    color: '#1F2937',
    margin: '0 0 8px',
    textAlign: 'center',
  },
  errorMessage: {
    fontSize: '14px',
    color: '#DC2626',
    background: '#FEE2E2',
    padding: '12px',
    borderRadius: '8px',
    margin: '0 0 16px',
    lineHeight: '1.5',
    textAlign: 'center',
  },
  retryButton: {
    width: '100%',
    padding: '12px 24px',
    borderRadius: '12px',
    border: 'none',
    background: '#EF4444',
    color: '#ffffff',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background-color 0.3s ease',
  },
};

// 글로벌 스타일에 애니메이션 추가
if (typeof document !== 'undefined' && !document.getElementById('voiceRecorderStyles')) {
  const styleSheet = document.createElement('style');
  styleSheet.id = 'voiceRecorderStyles';
  styleSheet.textContent = `
    @keyframes pulse {
      0%, 100% {
        opacity: 1;
      }
      50% {
        opacity: 0.4;
      }
    }
    @keyframes spin {
      from {
        transform: rotate(0deg);
      }
      to {
        transform: rotate(360deg);
      }
    }
  `;
  document.head.appendChild(styleSheet);
}
