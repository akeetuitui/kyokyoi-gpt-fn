
// kyokyoi-gpt-fn/functions/services/analyzeTasterType.js

const { OpenAI } = require("openai");
const functions = require('firebase-functions');

// OpenAI 클라이언트 초기화
const openai = new OpenAI({
  apiKey: functions.config().openai.key,
});

/**
 * 🎨 5가지 감상가 유형 정의
 */
const TASTER_TYPES = {
  'AF': {
    modal: 'TypeE',
    artist: '이우환',
    name: '형식 탐구가',
    description: '사소한 요소 속에서 깊은 의미를 읽어내는 디테일 탐정형'
  },
  'AC': {
    modal: 'TypeD', 
    artist: '백남준',
    name: '의미 해석가',
    description: '시대의 흐름을 꿰뚫는 사회 분석가형'
  },
  'IF': {
    modal: 'TypeA',
    artist: '쿠사마 야요이', 
    name: '감각적 체험가',
    description: '감각의 소용돌이에 빠져드는 몰입형'
  },
  'IC': {
    modal: 'TypeC',
    artist: '데이비드 호크니',
    name: '감성적 스토리텔러', 
    description: '장면 너머의 이야기를 상상하는 감상적 스토리텔러'
  },
  'XX': {
    modal: 'TypeB',
    artist: '앤디 워홀',
    name: '다채로운 탐색가',
    description: '경계를 넘나드는 탐험형'
  }
};

/**
 * 🎯 GPT 분석용 프롬프트 생성
 * @param {Array} records - 사용자의 감상 기록 배열
 * @returns {string} - GPT에게 보낼 완성된 프롬프트
 */
function createAnalysisPrompt(records) {
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

  // 실제 사용자 감상문들을 프롬프트에 추가
  const recordsSection = records.map((record, index) => `
**감상문 ${index + 1}**:
- 전시: ${record.exhibition_name} | 작가: ${record.artist_name}
- 감상문: "${record.review_text}"
- 방문일: ${record.visit_date}
`).join('\n');

  const analysisInstructions = `
## 📊 분석 방법:
1. 각 감상문에서 키워드 패턴을 찾아보세요
2. 사용자의 표현 방식(분석적 vs 직관적)을 판단하세요  
3. 관심 영역(형식미 vs 내용)을 파악하세요
4. 3개 감상문의 일관성을 확인하세요
5. 가장 적합한 예술가 유형을 선택하세요

## 📊 응답 형식 (JSON으로만 응답):
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
2. 점수는 -2, -1, 0, +1, +2 중 하나만 사용
3. confidence 기준:
   - 상: 3개 감상문 모두 일관된 패턴, 충분한 길이 (각 10자 이상)
   - 중: 2개 감상문에서 일관성, 적당한 길이  
   - 하: 패턴 불일치 또는 너무 짧은 텍스트 (5자 이하)
4. 애매한 경우 XX(앤디 워홀) 타입 선택
5. 반드시 JSON 형식으로만 응답하고 추가 설명 금지
6. 감상문이 비어있거나 의미 없는 텍스트면 confidence를 '하'로 설정
`;

  return basePrompt + recordsSection + analysisInstructions;
}

/**
 * 🤖 GPT API 호출 및 분석 실행
 * @param {Array} records - 사용자의 감상 기록 배열
 * @returns {Object} - GPT 분석 결과
 */
async function analyzeTasterType(records) {
  try {
    console.log('[analyzeTasterType] 🚀 GPT 분석 시작');
    console.log('[analyzeTasterType] 📊 분석할 기록 수:', records.length);

    // 프롬프트 생성
    const prompt = createAnalysisPrompt(records);
    console.log('[analyzeTasterType] 📝 프롬프트 길이:', prompt.length);

    // GPT API 호출
    const chatCompletion = await openai.chat.completions.create({
      model: "gpt-4o", // 또는 "gpt-4" 또는 "gpt-3.5-turbo"
      messages: [
        {
          role: "system", 
          content: "당신은 예술 감상 전문 분석가입니다. 주어진 감상문을 정확히 분석하여 반드시 JSON 형식으로만 응답하세요. 추가 설명이나 마크다운 문법은 절대 사용하지 마세요."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 2000,
      temperature: 0.3, // 일관성을 위해 낮은 temperature
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    });

    const gptResponse = chatCompletion.choices[0].message.content.trim();
    console.log('[analyzeTasterType] ✅ GPT 응답 수신 완료');
    console.log('[analyzeTasterType] 📄 응답 길이:', gptResponse.length);

    return gptResponse;

  } catch (error) {
    console.error('[analyzeTasterType] ❌ GPT 분석 실패:', error);
    
    // OpenAI API 에러 상세 로깅
    if (error.response) {
      console.error('[analyzeTasterType] API 응답 에러:', {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      });
    }
    
    throw new Error(`GPT 분석 중 오류 발생: ${error.message}`);
  }
}

/**
 * 📊 분석 결과 구조화
 * @param {string} userId - 사용자 ID
 * @param {Object} gptData - GPT 분석 결과
 * @param {Array} records - 분석에 사용된 기록들
 * @returns {Object} - 구조화된 최종 결과
 */
function structureAnalysisResult(userId, gptData, records) {
  const artistType = gptData.primary_type;
  const typeInfo = TASTER_TYPES[artistType];
  
  if (!typeInfo) {
    console.warn(`[structureAnalysisResult] 알 수 없는 타입: ${artistType}, XX로 대체`);
    return structureAnalysisResult(userId, { ...gptData, primary_type: 'XX' }, records);
  }
  
  return {
    user_id: userId,
    artist_type: artistType,
    artist_name: typeInfo.artist,
    type_name: typeInfo.name,
    type_description: typeInfo.description,
    modal_type: typeInfo.modal,
    confidence: gptData.confidence,
    gpt_analysis: gptData,
    analyzed_records_count: records.length,
    analyzed_records: records.map(r => ({
      exhibition_name: r.exhibition_name,
      artist_name: r.artist_name,
      visit_date: r.visit_date
    })),
    analyzed_at: new Date().toISOString(),
    version: '1.0'
  };
}

module.exports = {
  analyzeTasterType,
  structureAnalysisResult,
  TASTER_TYPES,
  createAnalysisPrompt // 테스트용으로 export
};