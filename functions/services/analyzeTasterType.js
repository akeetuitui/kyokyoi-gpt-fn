// kyokyoi-gpt-fn/functions/services/analyzeTasterType.js

const { OpenAI } = require("openai");
const functions = require("firebase-functions");

// 🔧 OpenAI 클라이언트 초기화
let openai;
try {
  const apiKey = functions.config().openai?.key;
  if (!apiKey) {
    throw new Error(
      "OpenAI API 키가 설정되지 않았습니다. " +
      "firebase functions:config:set openai.key=\"YOUR_KEY\"를 실행하세요.",
    );
  }

  openai = new OpenAI({
    apiKey: apiKey,
    timeout: 60000, // 60초 타임아웃
    maxRetries: 2,   // 최대 2회 재시도
  });

  console.log("[OpenAI] ✅ 클라이언트 초기화 완료");
} catch (error) {
  console.error("[OpenAI] ❌ 클라이언트 초기화 실패:", error.message);
}

/**
 * 🎨 예술가 타입별 매핑 정보 (새로 추가)
 */
const ARTIST_TYPE_MAPPING = {
  AF: {
    artistName: "이우환",
    typeName: "형식 탐구가",
    modalType: "TypeE",
    typeDescription:
      "당신은 예술 작품의 형식과 구조를 세밀하게 분석하는 탐구가입니다. " +
      "색채, 구도, 질감 등 시각적 요소를 과학자처럼 관찰하고 해부하며, " +
      "작품의 완성도와 기법적 우수성에 주목합니다.",
  },
  AC: {
    artistName: "백남준",
    typeName: "의미 해석가",
    modalType: "TypeD",
    typeDescription:
      "당신은 작품 속 깊은 의미와 사회적 맥락을 해석하는 분석가입니다. " +
      "작가의 의도와 사회적 메시지를 평론가처럼 분석하며, " +
      "작품이 담고 있는 철학적 의미를 탐구합니다.",
  },
  IF: {
    artistName: "쿠사마 야요이",
    typeName: "감각적 체험가",
    modalType: "TypeA",
    typeDescription:
      "당신은 감각의 소용돌이에 빠져드는 몰입형 감상가입니다. " +
      "눈앞에 펼쳐진 색과 빛, 패턴에 온몸이 먼저 반응하고, " +
      "시각적 임팩트와 즉각적인 느낌을 중시합니다.",
  },
  IC: {
    artistName: "데이비드 호크니",
    typeName: "감성적 스토리텔러",
    modalType: "TypeC",
    typeDescription:
      "당신은 작품을 통해 개인적인 이야기를 만들어내는 감성가입니다. " +
      "작품과 감정적으로 교감하며, 개인 경험과 연결하여 따뜻한 스토리를 만들어냅니다.",
  },
  XX: {
    artistName: "앤디 워홀",
    typeName: "다채로운 탐색가",
    modalType: "TypeB",
    typeDescription:
      "당신은 유연하고 다양한 관점으로 예술을 탐색하는 탐험가입니다. " +
      "고정된 패턴 없이 상황에 따라 유연하게 반응하며, " +
      "새로운 시도와 다양성을 즐깁니다.",
  },
};

/**
 * 🤖 GPT API 호출 및 분석 실행 (기존 로직 유지 + 모델만 변경)
 * @param {Array} records - 사용자의 감상 기록 배열
 * @returns {Object} - GPT 분석 결과
 */
async function analyzeTasterType(records) {
  try {
    console.log("[analyzeTasterType] 🚀 GPT 분석 시작");
    console.log("[analyzeTasterType] 📊 분석할 기록 수:", records.length);

    // 🔧 입력 데이터 검증
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error("분석할 기록이 없습니다.");
    }

    // 감상문 총 길이 체크 (너무 짧으면 분석 품질 저하)
    const totalReviewLength = records.reduce(
      (sum, record) => sum + (record.review_text?.length || 0),
      0,
    );
    console.log("[analyzeTasterType] 📝 총 감상문 길이:", totalReviewLength);

    if (totalReviewLength < 30) {
      console.warn("[analyzeTasterType] ⚠️ 감상문 길이가 너무 짧음, 신뢰도 낮을 수 있음");
    }

    // 프롬프트 생성 (기존 상세한 버전 유지)
    const prompt = createAnalysisPrompt(records);
    console.log("[analyzeTasterType] 📝 프롬프트 길이:", prompt.length);

    // 프롬프트가 너무 긴 경우에만 제한 (기존보다 관대하게)
    if (prompt.length > 150000) { // 15만자로 증가
      console.warn("[analyzeTasterType] ⚠️ 프롬프트가 너무 길어 일부 기록 제외");
      const trimmedRecords = records.slice(0, Math.min(15, records.length)); // 15개로 증가
      return await analyzeTasterType(trimmedRecords);
    }

    // GPT API 호출 (비용 효율적인 모델로 변경)
    console.log("[analyzeTasterType] 🤖 OpenAI API 호출 중...");
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o-mini", // 🎯 핵심 개선: 비용 효율적인 모델 사용
      messages: [
        {
          role: "system",
          content:
            "당신은 예술 감상 전문 분석가입니다. 사용자의 감상문을 정확히 분석하여 반드시 유효한 JSON 형식으로만 응답하세요.\n\n" +
            "중요 규칙:\n" +
            "1. 응답은 반드시 JSON 형식만 사용\n" +
            "2. 마크다운 문법이나 추가 설명 금지\n" +
            "3. primary_type은 AF, AC, IF, IC, XX 중 하나만 사용\n" +
            "4. confidence는 상, 중, 하 중 하나만 사용\n" +
            "5. 분석이 어려우면 XX 타입과 하 신뢰도 사용",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 2000,
      temperature: 0.3, // 일관성을 위해 낮은 temperature
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
      response_format: { type: "json_object" }, // JSON 형식 강제
    });

    // 응답 검증
    if (!chatCompletion.choices || chatCompletion.choices.length === 0) {
      throw new Error("OpenAI API에서 응답을 받지 못했습니다.");
    }

    const gptResponse = chatCompletion.choices[0].message.content.trim();
    console.log("[analyzeTasterType] ✅ GPT 응답 수신 완료");
    console.log("[analyzeTasterType] 📄 응답 길이:", gptResponse.length);

    // 토큰 사용량 로그 (비용 추적용)
    if (chatCompletion.usage) {
      console.log("[analyzeTasterType] 💰 토큰 사용량:", {
        prompt_tokens: chatCompletion.usage.prompt_tokens,
        completion_tokens: chatCompletion.usage.completion_tokens,
        total_tokens: chatCompletion.usage.total_tokens,
        // gpt-4o-mini 예상 비용
        estimated_cost:
          `약 $${(chatCompletion.usage.total_tokens * 0.00015 / 1000).toFixed(4)}`,
      });
    }

    // 응답 내용 미리보기 (디버깅용)
    console.log("[analyzeTasterType] 🔍 응답 미리보기:", gptResponse.substring(0, 200) + "...");

    return gptResponse;
  } catch (error) {
    console.error("[analyzeTasterType] ❌ GPT 분석 실패:", error);

    // 🔧 OpenAI API 특정 오류 처리 (기존과 동일)
    if (error.response) {
      const status = error.response.status;
      const errorData = error.response.data;

      console.error("[analyzeTasterType] API 응답 에러:", {
        status: status,
        error_type: errorData?.error?.type,
        error_code: errorData?.error?.code,
        error_message: errorData?.error?.message,
      });

      // 사용자 친화적 에러 메시지 생성
      switch (status) {
      case 401:
        throw new Error("OpenAI API 인증 실패: API 키를 확인해주세요.");
      case 429:
        throw new Error("OpenAI API 요청 한도 초과: 잠시 후 다시 시도해주세요.");
      case 500:
      case 502:
      case 503:
        throw new Error("OpenAI 서버 오류: 잠시 후 다시 시도해주세요.");
      default:
        throw new Error(`OpenAI API 오류 (${status}): ${errorData?.error?.message || "알 수 없는 오류"}`);
      }
    } else if (error.code === "ENOTFOUND") {
      throw new Error("네트워크 연결 오류: 인터넷 연결을 확인해주세요.");
    } else if (error.code === "ECONNRESET" || error.code === "ETIMEDOUT") {
      throw new Error("OpenAI API 연결 시간 초과: 잠시 후 다시 시도해주세요.");
    } else {
      throw new Error(`GPT 분석 중 오류 발생: ${error.message}`);
    }
  }
}

/**
 * 🎯 GPT 분석용 프롬프트 생성 (기존 상세한 버전 그대로 유지)
 * @param {Array} records - 사용자의 감상 기록 배열
 * @returns {string} - GPT에게 보낼 완성된 프롬프트
 */
function createAnalysisPrompt(records) {
  // 🔧 기존의 상세한 프롬프트 그대로 유지
  const basePrompt = `
당신은 예술 감상 심리학 전문가입니다. 사용자의 전시 감상문을 분석하여 다음 5가지 예술가 유형 중 가장 유사한 유형을 찾아주세요.

## 🎨 5가지 예술가 유형 정의

### 1️⃣ 이우환 스타일 (AF) - 형식 탐구가
**특징**: 분석적 + 형식미 중심
- **분석 키워드**: "구조", "기법", "완성도", "분석", "체계적", "정교한", "계산된", "논리적", "세밀한"
- **형식 키워드**: "색채", "구도", "질감", "공간", "비례", "균형", "선", "형태", "배치", "조화", "대비"
- **행동 패턴**: 작품을 과학자처럼 분석, 시각적 요소를 세밀하게 관찰하고 해부
- **대표 표현**: "이 점의 배치가 정교하다", "색상 대비의 비율이 완벽하다", "구도의 완성도가 높다", "기법이 뛰어나다"

### 2️⃣ 백남준 스타일 (AC) - 의미 해석가  
**특징**: 분석적 + 내용/맥락 중심
- **분석 키워드**: "해석", "의도", "평가", "비판적", "체계적", "논리적", "분석적", "객관적"
- **내용 키워드**: "의미", "메시지", "사회적", "상징", "맥락", "시대적", "철학적", "문제의식", "비판"
- **행동 패턴**: 작품을 평론가처럼 해석, 사회적 맥락과 작가의 의도를 깊이 분석
- **대표 표현**: "이것은 사회 비판이다", "작가의 의도가 명확하다", "시대적 맥락에서 중요한 의미", "메시지가 강력하다"

### 3️⃣ 쿠사마 야요이 스타일 (IF) - 감각적 체험가
**특징**: 직관적 + 형식미 중심  
- **직관 키워드**: "느낌", "감각", "몰입", "체감", "와닿다", "끌린다", "신기하다", "압도적", "환상적"
- **형식 키워드**: "예쁘다", "화려하다", "빛", "색감", "패턴", "반짝반짝", "눈부시다", "아름답다", "멋지다"
- **행동 패턴**: 작품에 감각적으로 몰입, 시각적 임팩트와 즉각적인 느낌을 중시
- **대표 표현**: "와! 색깔이 너무 예뻐", "눈이 휘둥그레졌다", "완전 몰입하게 된다", "감각적으로 끌린다"

### 4️⃣ 호크니 스타일 (IC) - 감성적 스토리텔러
**특징**: 직관적 + 내용/이야기 중심
- **직관 키워드**: "마음", "감동", "공감", "따뜻하다", "그리움", "추억", "울컥", "뭉클하다", "감정"
- **내용 키워드**: "이야기", "인생", "경험", "관계", "일상", "개인적", "기억", "감정", "사랑", "삶"
- **행동 패턴**: 작품과 감정적으로 교감, 개인 경험과 연결하여 스토리를 만들어냄
- **대표 표현**: "나의 어린 시절 같다", "마음이 따뜻해진다", "이 사람 마음을 알겠다", "내 이야기 같다"

### 5️⃣ 앤디 워홀 스타일 (XX) - 다채로운 탐색가
**특징**: 균형적/유연한 감상 스타일
- **균형 키워드**: "다양하다", "흥미롭다", "새롭다", "독특하다", "재미있다", "특별하다", "신선하다"
- **행동 패턴**: 상황에 따라 유연하게 반응, 고정된 패턴 없이 다양한 관점으로 접근
- **대표 표현**: "이것도 좋고 저것도 좋다", "처음 보는 스타일이네", "새로운 시도가 재미있다"

## 📝 분석할 감상문들:
`;

  // 실제 사용자 감상문들을 프롬프트에 추가 (기존 형식 유지)
  const recordsSection = records.map((record, index) => `
**감상문 ${index + 1}**:
- 전시명: ${record.exhibition_name}
- 작가명: ${record.artist_name}
- 방문일: ${record.visit_date}
- 감상문: "${record.review_text}"
- 감상문 길이: ${record.review_text.length}자
`).join("\n");

  const analysisInstructions = `
## 📊 분석 방법:
1. 각 감상문에서 키워드 패턴을 찾아보세요
2. 사용자의 표현 방식(분석적 vs 직관적)을 판단하세요  
3. 관심 영역(형식미 vs 내용)을 파악하세요
4. ${records.length}개 감상문의 일관성을 확인하세요
5. 가장 적합한 예술가 유형을 선택하세요

## 📊 응답 형식 (유효한 JSON으로만 응답):
{
  "primary_type": "AF/AC/IF/IC/XX 중 하나",
  "confidence": "상/중/하",
  "analysis": {
    "인지처리방식": {
      "점수": 0,
      "근거": "분석적/직관적 성향 판단 근거를 구체적으로",
      "특징적_표현": ["사용자가 사용한 분석적/직관적 표현들"]
    },
    "관심영역": {
      "점수": 0, 
      "근거": "형식미/내용 중심 성향 판단 근거를 구체적으로",
      "특징적_표현": ["사용자가 사용한 형식미/내용 관련 표현들"]
    }
  },
  "matching_reason": "이 예술가 타입을 선택한 구체적인 이유 (사용자 표현 인용 포함)",
  "user_characteristics": [
    "사용자 감상 특징 1",
    "사용자 감상 특징 2", 
    "사용자 감상 특징 3"
  ]
}

## ⚠️ 중요 규칙:
1. primary_type은 반드시 AF, AC, IF, IC, XX 중 하나만 사용
2. 점수는 -2, -1, 0, +1, +2 중 하나만 사용 (인지처리방식: 분석적 +2, 직관적 -2 / 관심영역: 형식미 +2, 내용 -2)
3. confidence 기준:
   - 상: ${records.length}개 감상문 모두 일관된 패턴, 충분한 길이 (각 10자 이상)
   - 중: ${Math.max(2, records.length-1)}개 이상 감상문에서 일관성, 적당한 길이  
   - 하: 패턴 불일치 또는 너무 짧은 텍스트 (5자 이하)
4. 애매한 경우 XX(앤디 워홀) 타입 선택
5. 반드시 유효한 JSON 형식으로만 응답
6. 감상문이 비어있거나 의미 없는 텍스트면 confidence를 '하'로 설정
7. 추가 설명이나 마크다운 문법 절대 사용 금지
`;

  return basePrompt + recordsSection + analysisInstructions;
}

/**
 * 📊 GPT 분석 결과를 최종 구조로 변환 (개선된 버전)
 * @param {string} userId - 사용자 ID
 * @param {object} gptResult - GPT 분석 결과(JSON)
 * @param {Array} records - 사용자의 감상 기록 배열
 * @returns {object} - 구조화된 분석 결과
 */
function structureAnalysisResult(userId, gptResult, records) {
  const artistType = gptResult.primary_type || "XX";
  const mapping = ARTIST_TYPE_MAPPING[artistType];

  // 분석된 기록 정보 (모든 기록 포함, 제한 없음)
  const analyzedRecords = records.map((record) => ({
    exhibition_name: record.exhibition_name,
    artist_name: record.artist_name,
    visit_date: record.visit_date,
  }));

  return {
    user_id: userId,
    artist_type: artistType,
    artist_name: mapping.artistName,
    type_name: mapping.typeName,
    type_description: mapping.typeDescription,
    modal_type: mapping.modalType,
    confidence: gptResult.confidence || "중",
    gpt_analysis: {
      // 기존의 상세한 분석 결과 모두 포함
      primary_type: gptResult.primary_type,
      confidence: gptResult.confidence,
      analysis: gptResult.analysis || {},
      matching_reason: gptResult.matching_reason || "",
      user_characteristics: gptResult.user_characteristics || [],
    },
    analyzed_records_count: records.length, // 모든 기록 수 포함
    analyzed_records: analyzedRecords, // 모든 기록 정보 포함
    analyzed_at: new Date().toISOString(),
    version: "1.1", // 버전 업데이트
  };
}

// 예술가 유형 코드 상수 (기존 유지)
const TASTER_TYPES = {
  AF: "이우환 스타일 (형식 탐구가)",
  AC: "백남준 스타일 (의미 해석가)",
  IF: "쿠사마 야요이 스타일 (감각적 체험가)",
  IC: "호크니 스타일 (감성적 스토리텔러)",
  XX: "앤디 워홀 스타일 (다채로운 탐색가)",
};

module.exports = {
  analyzeTasterType,
  structureAnalysisResult,
  TASTER_TYPES,
  ARTIST_TYPE_MAPPING, // 새로 추가
  createAnalysisPrompt, // 테스트용으로 export
};