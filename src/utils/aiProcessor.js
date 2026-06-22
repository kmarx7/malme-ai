/**
 * AI 음성 처리 모듈
 *
 * OpenRouter API를 활용한 STT(음성→텍스트)와 NLU(요약/태그/카테고리 분류) 구현
 *
 * STT 전략:
 * - Gemini 2.5 Flash의 audio input 지원 (OpenRouter를 통한 직접 호출)
 * - Fallback chain: Gemini Flash → Gemini Pro → GPT-4o Audio
 *
 * 요약/분류:
 * - OpenRouter LLM (json_object 모드)로 structured output 생성
 * - Fallback chain: Gemini Flash → Gemini Pro
 */

const ENDPOINT = 'https://openrouter.ai/api/v1/chat/completions';

const MODELS = [
  import.meta.env.VITE_OPENROUTER_MODEL,
  import.meta.env.VITE_OPENROUTER_FALLBACK_1,
  import.meta.env.VITE_OPENROUTER_FALLBACK_2,
].filter(Boolean);

const STT_MODELS = MODELS.slice(0, 2); // STT용: Flash, Pro만 사용 (Audio 지원)

/**
 * OpenRouter API 요청 헤더 생성
 * @returns {Object} HTTP 헤더
 */
function buildHeaders() {
  return {
    'Authorization': `Bearer ${import.meta.env.VITE_OPENROUTER_API_KEY}`,
    'HTTP-Referer': import.meta.env.VITE_APP_URL,
    'X-Title': import.meta.env.VITE_APP_NAME,
    'Content-Type': 'application/json',
  };
}

/**
 * Fallback 체인 실행 헬퍼
 *
 * 모델 목록을 순서대로 시도하고, 첫 성공 시 즉시 반환합니다.
 * 모든 모델 실패 시 마지막 에러를 throw합니다.
 *
 * @param {Array<string>} models - 시도할 모델 목록
 * @param {Function} buildBody - 모델명을 받아서 요청 body를 반환하는 함수
 * @returns {Promise<string>} API 응답의 content 필드 값
 * @throws {Error} 모든 모델 호출 실패 시
 */
async function callWithFallback(models, buildBody) {
  let lastError;

  for (const model of models) {
    try {
      console.log(`[aiProcessor] Trying model: ${model}`);
      const res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: buildHeaders(),
        body: JSON.stringify(buildBody(model)),
      });

      // 429 (Rate Limit) 또는 5xx 오류는 재시도
      if (res.status === 429 || res.status >= 500) {
        await new Promise((r) => setTimeout(r, 1000));
        throw new Error(`서버 오류 (${res.status})`);
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        const errorMsg = errorData?.error?.message || `HTTP ${res.status}`;
        throw new Error(`API 오류: ${errorMsg}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error('응답에서 content를 추출할 수 없습니다');
      }

      console.log(`[aiProcessor] ${model} 성공`);
      return content;
    } catch (err) {
      lastError = err;
      console.warn(`[aiProcessor] ${model} 실패: ${err.message}`);
    }
  }

  throw lastError ?? new Error('모든 모델 호출에 실패했습니다.');
}

/**
 * 음성 파일을 텍스트로 변환 (Speech-to-Text / STT)
 *
 * Gemini 2.5의 audio input 기능을 활용하여 음성을 한국어 텍스트로 변환합니다.
 * OpenRouter API는 OpenAI-compatible 인터페이스를 제공하므로 표준 fetch로 호출 가능합니다.
 *
 * 동작 원리:
 * 1. base64 인코딩된 음성 데이터를 OpenRouter API로 전송
 * 2. Gemini 모델이 audio input을 처리하여 텍스트 반환
 * 3. Fallback chain: Gemini-2.5-flash → Gemini-2.5-pro → GPT-4o-audio
 *
 * @param {string} base64Audio - base64로 인코딩된 음성 데이터 (전체 base64 문자열, 프리픽스 없음)
 * @param {string} mimeType - 음성 파일의 MIME 타입 (예: 'audio/webm', 'audio/mp3', 'audio/wav')
 * @returns {Promise<string>} 변환된 한국어 텍스트
 *
 * @throws {Error} 모든 모델 호출 실패, 네트워크 오류, 또는 API 오류 발생 시
 *
 * @example
 * // WebRecorder API로 녹음한 음성을 처리하는 예시
 * const audioBlob = await recordAudio(); // audio/webm Blob
 * const base64 = await blobToBase64(audioBlob);
 * const text = await transcribeAudio(base64, 'audio/webm');
 * console.log(text); // "녹음된 음성이 이렇게 텍스트로 변환됩니다"
 */
export async function transcribeAudio(base64Audio, mimeType = 'audio/webm') {
  console.log('[aiProcessor] transcribeAudio 시작:', {
    audioLength: base64Audio.length,
    mimeType,
  });

  const audioFormat = mimeType.split('/')[1] ?? 'webm';

  try {
    const text = await callWithFallback(STT_MODELS, (model) => ({
      model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: '다음 음성을 한국어로 정확하게 텍스트로 변환해줘. 변환된 텍스트만 반환하고 다른 설명은 하지 마.',
            },
            {
              type: 'input_audio',
              input_audio: {
                data: base64Audio,
                format: audioFormat,
              },
            },
          ],
        },
      ],
    }));

    if (!text || text.trim().length === 0) {
      throw new Error('음성 인식 결과가 없습니다. 다시 시도해주세요.');
    }

    console.log('[aiProcessor] STT 성공:', { resultLength: text.length });
    return text.trim();
  } catch (err) {
    console.error('[aiProcessor] STT 실패:', err.message);
    if (err.message.includes('음성 인식')) throw err;
    throw new Error('음성 변환 중 오류가 발생했습니다. 인터넷 연결을 확인해주세요.');
  }
}

/**
 * 전사된 텍스트를 요약하고 태그/카테고리를 추출 (NLU / 자연언어 이해)
 *
 * OpenRouter LLM의 json_object 응답 형식을 활용하여 구조화된 출력을 생성합니다.
 * Gemini 모델은 JSON 모드를 강제로 적용하여 파싱 가능한 JSON만 반환하도록 합니다.
 *
 * 처리 흐름:
 * 1. 사용자 프롬프트에 텍스트를 포함하여 요청
 * 2. response_format: { type: 'json_object' } 옵션으로 JSON 모드 활성화
 * 3. LLM이 반환한 JSON을 파싱하여 summary, tags, category 추출
 * 4. JSON 파싱 실패 시 기본값으로 graceful fallback
 *
 * @param {string} transcribedText - STT로 변환된 음성 텍스트
 * @returns {Promise<Object>} 구조화된 분석 결과
 * @returns {string} result.summary - 한 문장으로 요약한 내용 (40자 이내)
 * @returns {Array<string>} result.tags - 추출된 키워드 배열 (3개)
 * @returns {string} result.category - 분류된 카테고리 ("회의" | "할일" | "아이디어" | "일반")
 * @returns {string} result.originalText - 원본 텍스트 (저장 시 참조용)
 *
 * @throws {Error} API 호출 실패 또는 환경변수 누락 시
 *
 * @example
 * const memo = await summarizeMemo("내일 오전 10시에 회의실에서 분기별 현황 보고가 있습니다");
 * console.log(memo);
 * // {
 * //   summary: "내일 오전 10시 분기별 현황 보고 회의",
 * //   tags: ["회의", "분기보고", "내일"],
 * //   category: "회의",
 * //   originalText: "..."
 * // }
 */
export async function summarizeMemo(transcribedText) {
  console.log('[aiProcessor] summarizeMemo 시작:', {
    textLength: transcribedText.length,
  });

  if (!transcribedText || transcribedText.trim().length === 0) {
    console.warn('[aiProcessor] 빈 텍스트 입력됨, 기본값 반환');
    return {
      summary: '(내용 없음)',
      tags: [],
      category: '일반',
      originalText: transcribedText,
    };
  }

  const prompt = `다음 음성 메모 텍스트를 분석해서 JSON 형태로 반환해줘.

텍스트: "${transcribedText}"

반환 형식 (JSON만 반환, 다른 설명 없이):
{
  "summary": "한 문장으로 요약한 내용",
  "tags": ["태그1", "태그2", "태그3"],
  "category": "회의|할일|아이디어|일반 중 하나"
}

규칙:
- summary: 핵심 내용을 한 문장으로 (40자 이내)
- tags: 핵심 키워드 3개 (# 없이)
- category: 회의, 할일, 아이디어, 일반 중 가장 적합한 것 하나`;

  try {
    const raw = await callWithFallback(
      [
        import.meta.env.VITE_OPENROUTER_MODEL,
        import.meta.env.VITE_OPENROUTER_FALLBACK_1,
      ],
      (model) => ({
        model,
        messages: [
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      })
    );

    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      // response_format이 무시된 경우 정규식으로 추출 시도
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        parsed = JSON.parse(match[0]);
      } else {
        throw new Error('JSON 파싱 실패');
      }
    }

    // 응답 검증 및 기본값 처리
    const result = {
      summary: parsed.summary?.slice(0, 40) ?? transcribedText.slice(0, 40),
      tags: Array.isArray(parsed.tags) ? parsed.tags.slice(0, 3) : [],
      category: parsed.category ?? '일반',
      originalText: transcribedText,
    };

    console.log('[aiProcessor] 요약/분류 성공:', {
      summary: result.summary,
      tags: result.tags,
      category: result.category,
    });

    return result;
  } catch (err) {
    console.error('[aiProcessor] 요약/분류 실패:', err.message);

    // Graceful fallback: 파싱 실패 시 기본값 반환
    console.warn('[aiProcessor] 기본값으로 폴백합니다');
    return {
      summary: transcribedText.slice(0, 40),
      tags: [],
      category: '일반',
      originalText: transcribedText,
    };
  }
}
