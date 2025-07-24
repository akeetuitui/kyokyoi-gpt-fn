// kyokyoi-gpt-fn/functions/index.js

const functions = require('firebase-functions');
const admin = require('firebase-admin');
const { Configuration, OpenAIApi } = require('openai');

// Firebase Admin 초기화
admin.initializeApp();
const db = admin.firestore();

// OpenAI 설정
const configuration = new Configuration({
  apiKey: functions.config().openai.key, // firebase functions:config:set openai.key="your-api-key"
});
const openai = new OpenAIApi(configuration);

// 5가지 감상가 유형 정의
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
 * 사용자의 NOW 기록 가져오기
 */
async function getUserNowRecords(userId) {
  try {
    console.log(`[getUserNowRecords] 사용자 ${userId}의 기록 조회 시작`);
    
    const recordsRef = db.collection('users')
                        .doc(userId)
                        .collection('now_records')
                        .orderBy('created_at', 'desc')
                        .limit(10); // 최근 10개까지만
    
    const snapshot = await recordsRef.get();
    
    const records = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      // 감상문이 있는 기록만 포함
      if (data.review_text && data.review_text.trim().length > 0) {
        records.push({
          id: doc.id,
          exhibition_name: data.exhibition_name || '미상',
          artist_name: data.artist_name || '미상',
          review_text: data.review_text.trim(),
          visit_date: data.visit_date ? data.visit_date.toDate().toISOString().split('T')[0] : '미상',
          created_at: data.created_at ? data.created_at.toDate().toISOString() : '미상'
        });
      }
    });
    
    console.log(`[getUserNowRecords] ${records.length}개 기록 조회 완료`);
    return records;
    
  } catch (error) {
    console.error(`[getUserNowRecords] 기록 조회 실패:`, error);
    throw error;
  }
}

/**
 * GPT 분석용 프롬프트 생성
 */
function createAnalysisPrompt(records) {
  let prompt = `
당신은 예술 감상 심리학 전문가입니다. 사용자의 전시 감상문을 분석하여 다음 5가지 예술가 유형 중 가장 유사한 유형을 찾아주세요.

## 🎨 5가지 예술가 유형 정의

### 1️⃣ 이우환 스타일 (AF) - 형식 탐구가
**특징**: 분석적 + 형식미 중심
- **분석 키워드**: "구조", "기법", "완성도", "분석", "체계적", "정교한", "계산된"
- **형식 키워드**: "색채", "구도", "질감", "공간", "비례", "균형", "선", "형태"
- **행동 패턴**: 작품을 과학자처럼 분석, 시각적 요소 해부
- **대표 표현**: "이 점의 배치가...", "색상 대비의 비율이...", "구도의 완성도가..."

### 2️⃣ 백남준 스타일 (AC) - 의미 해석가  
**특징**: 분석적 + 내용/맥락 중심
- **분석 키워드**: "해석", "의도", "평가", "비판적", "체계적", "논리적"
- **내용 키워드**: "의미", "메시지", "사회적", "상징", "맥락", "시대적", "철학적"
- **행동 패턴**: 작품을 평론가처럼 해석, 사회적 맥락 분석
- **대표 표현**: "이건 사회 비판이다", "작가의 의도는...", "시대적 맥락에서..."

### 3️⃣ 쿠사마 야요이 스타일 (IF) - 감각적 체험가
**특징**: 직관적 + 형식미 중심  
- **직관 키워드**: "느낌", "감각", "몰입", "체감", "와닿다", "끌린다", "신기하다"
- **형식 키워드**: "예쁘다", "화려하다", "빛", "색감", "패턴", "반짝반짝", "환상적"
- **행동 패턴**: 작품에 감각적으로 몰입, 시각적 임팩트 중시
- **대표 표현**: "와! 색깔이 너무 예뻐", "눈이 휘둥그레", "몰입하게 된다"

### 4️⃣ 호크니 스타일 (IC) - 감성적 스토리텔러
**특징**: 직관적 + 내용/이야기 중심
- **직관 키워드**: "마음", "감동", "공감", "따뜻하다", "그리움", "추억", "울컥"
- **내용 키워드**: "이야기", "인생", "경험", "관계", "일상", "개인적", "기억"
- **행동 패턴**: 작품과 감정적 교감, 개인 경험과 연결
- **대표 표현**: "나의 어린 시절 같다", "마음이 따뜻해진다", "이 사람 마음을 알겠다"

### 5️⃣ 앤디 워홀 스타일 (XX) - 다채로운 탐색가
**특징**: 균형적/유연한 감상 스타일
- **균형 키워드**: "다양하다", "흥미롭다", "새롭다", "독특하다", "재미있다", "특별하다"
- **행동 패턴**: 상황에 따라 유연하게, 고정된 패턴 없음
- **대표 표현**: "이것도 좋고 저것도 좋다", "처음 보는 스타일", "새로운 시도"

## 📝 분석할 감상문들:
`;

  // 감상문 추가
  records.forEach((record, index) => {
    prompt += `
**감상문 ${index + 1}**:
- 전시: ${record.exhibition_name} | 작가: ${record.artist_name}
- 감상문: "${record.review_text}"
- 방문일: ${record.visit_date}

`;
  });

  prompt += `
## 📊 응답 형식 (JSON으로만 응답):
{
  "primary_type": "AF/AC/IF/IC/XX 중 하나",
  "confidence": "상/중/하",
  "analysis": {
    "인지처리방식": {
      "점수": 0,
      "근거": "분석적/직관적 성향 판단 근거",
      "특징적_표현": ["해당 성향을 보여주는 사용자 표현들"]
    },
    "관심영역": {
      "점수": 0, 
      "근거": "형식미/내용 중심 성향 판단 근거",
      "특징적_표현": ["해당 성향을 보여주는 사용자 표현들"]
    }
  },
  "matching_reason": "왜 이 예술가 타입과 매칭되는지 구체적 설명",
  "user_characteristics": [
    "사용자의 감상 특징 3-5개"
  ]
}

## ⚠️ 중요 규칙:
1. primary_type은 반드시 AF, AC, IF, IC, XX 중 하나
2. 점수는 -2, -1, 0, +1, +2 중 하나
3. confidence는 감상문의 일관성과 분석 가능성 기준
4. 애매한 경우 XX(앤디 워홀) 타입 선택
5. 감상문이 너무 짧거나 불분명하면 confidence를 '하'로 설정
`;

  return prompt;
}

/**
 * GPT API 호출
 */
async function callGPTAnalysis(prompt) {
  try {
    console.log('[callGPTAnalysis] GPT API 호출 시작');
    
    const response = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        {
          role: "system", 
          content: "당신은 예술 감상 전문 분석가입니다. 주어진 감상문을 분석하여 정확한 JSON 형식으로만 응답하세요."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 1500,
      temperature: 0.3, // 일관성을 위해 낮은 temperature
    });

    const gptResponse = response.data.choices[0].message.content.trim();
    console.log('[callGPTAnalysis] GPT 응답 수신 완료');
    
    return gptResponse;
    
  } catch (error) {
    console.error('[callGPTAnalysis] GPT API 호출 실패:', error);
    throw error;
  }
}

/**
 * GPT 응답 검증 및 파싱
 */
function validateAndParseGPTResponse(gptResponse) {
  try {
    // JSON 마크다운 제거
    let cleanResponse = gptResponse;
    if (cleanResponse.includes('```json')) {
      cleanResponse = cleanResponse.replace(/```json/g, '').replace(/```/g, '').trim();
    }
    
    // JSON 파싱
    const parsed = JSON.parse(cleanResponse);
    
    // 필수 필드 검증
    const requiredFields = ['primary_type', 'confidence', 'analysis'];
    for (const field of requiredFields) {
      if (!parsed[field]) {
        throw new Error(`필수 필드 누락: ${field}`);
      }
    }
    
    // 유형 검증
    const validTypes = ['AF', 'AC', 'IF', 'IC', 'XX'];
    if (!validTypes.includes(parsed.primary_type)) {
      console.warn(`[validateGPT] 잘못된 유형 ${parsed.primary_type}, XX로 변경`);
      parsed.primary_type = 'XX';
    }
    
    // 신뢰도 검증
    const validConfidence = ['상', '중', '하'];
    if (!validConfidence.includes(parsed.confidence)) {
      console.warn(`[validateGPT] 잘못된 신뢰도 ${parsed.confidence}, 중으로 변경`);
      parsed.confidence = '중';
    }
    
    return {
      success: true,
      data: parsed
    };
    
  } catch (error) {
    console.error('[validateGPT] 응답 파싱 실패:', error);
    return {
      success: false,
      error: 'PARSE_ERROR',
      message: `GPT 응답 파싱 실패: ${error.message}`
    };
  }
}

/**
 * 분석 결과 구조화
 */
function structureAnalysisResult(userId, gptData, records) {
  const artistType = gptData.primary_type;
  const typeInfo = TASTER_TYPES[artistType];
  
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
    analyzed_at: admin.firestore.Timestamp.now(),
    version: '1.0'
  };
}

/**
 * 결과를 Firebase에 저장
 */
async function saveTasterTypeResult(userId, result) {
  try {
    console.log(`[saveTasterType] 사용자 ${userId} 결과 저장 시작`);
    
    // users/{userId}/taster_analysis 문서에 저장
    const analysisRef = db.collection('users')
                         .doc(userId)
                         .collection('taster_analysis')
                         .doc('latest');
    
    await analysisRef.set(result);
    
    // users/{userId} 문서에도 요약 정보 저장
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
      taster_type: {
        artist_type: result.artist_type,
        artist_name: result.artist_name,
        modal_type: result.modal_type,
        confidence: result.confidence,
        analyzed_at: result.analyzed_at,
        has_analysis: true
      }
    });
    
    console.log(`[saveTasterType] 저장 완료: ${result.artist_type}`);
    
  } catch (error) {
    console.error('[saveTasterType] 저장 실패:', error);
    throw error;
  }
}

/**
 * 기존 분석 결과 확인
 */
async function getExistingAnalysis(userId) {
  try {
    const analysisRef = db.collection('users')
                         .doc(userId)
                         .collection('taster_analysis')
                         .doc('latest');
    
    const doc = await analysisRef.get();
    
    if (doc.exists) {
      const data = doc.data();
      
      // 24시간 이내 결과면 재사용
      const analyzedAt = data.analyzed_at.toDate();
      const hoursAgo = (Date.now() - analyzedAt.getTime()) / (1000 * 60 * 60);
      
      if (hoursAgo < 24) {
        console.log(`[getExisting] 기존 결과 재사용 (${hoursAgo.toFixed(1)}시간 전)`);
        return data;
      }
    }
    
    return null;
    
  } catch (error) {
    console.error('[getExisting] 기존 결과 확인 실패:', error);
    return null;
  }
}

/**
 * 메인 분석 함수
 */
exports.analyzeTasterType = functions
  .region('asia-northeast3') // 서울 리전
  .runWith({
    timeoutSeconds: 60,
    memory: '512MB'
  })
  .https.onCall(async (data, context) => {
    try {
      // 인증 확인
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          '로그인이 필요합니다.'
        );
      }
      
      const userId = context.auth.uid;
      console.log(`[analyzeTasterType] 사용자 ${userId} 분석 요청`);
      
      // 1. 기존 분석 결과 확인
      const existingResult = await getExistingAnalysis(userId);
      if (existingResult) {
        console.log('[analyzeTasterType] 기존 결과 반환');
        return {
          success: true,
          result: existingResult,
          from_cache: true
        };
      }
      
      // 2. 사용자 기록 조회
      const records = await getUserNowRecords(userId);
      
      if (records.length < 3) {
        console.log(`[analyzeTasterType] 기록 부족: ${records.length}개`);
        throw new functions.https.HttpsError(
          'failed-precondition',
          `분석을 위해 최소 3개의 감상 기록이 필요합니다. (현재: ${records.length}개)`
        );
      }
      
      // 3. GPT 분석 실행
      const prompt = createAnalysisPrompt(records);
      const gptResponse = await callGPTAnalysis(prompt);
      
      // 4. 응답 검증
      const validationResult = validateAndParseGPTResponse(gptResponse);
      if (!validationResult.success) {
        throw new functions.https.HttpsError(
          'internal',
          validationResult.message
        );
      }
      
      // 5. 결과 구조화
      const finalResult = structureAnalysisResult(userId, validationResult.data, records);
      
      // 6. Firebase 저장
      await saveTasterTypeResult(userId, finalResult);
      
      console.log(`[analyzeTasterType] 분석 완료: ${finalResult.artist_type}`);
      
      return {
        success: true,
        result: finalResult,
        from_cache: false
      };
      
    } catch (error) {
      console.error('[analyzeTasterType] 분석 실패:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError(
        'internal',
        `분석 중 오류가 발생했습니다: ${error.message}`
      );
    }
  });

/**
 * 사용자의 분석 결과 조회 함수
 */
exports.getTasterType = functions
  .region('asia-northeast3')
  .https.onCall(async (data, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          'unauthenticated',
          '로그인이 필요합니다.'
        );
      }
      
      const userId = context.auth.uid;
      const result = await getExistingAnalysis(userId);
      
      if (!result) {
        throw new functions.https.HttpsError(
          'not-found',
          '분석 결과가 없습니다. 먼저 분석을 진행해주세요.'
        );
      }
      
      return {
        success: true,
        result: result
      };
      
    } catch (error) {
      console.error('[getTasterType] 조회 실패:', error);
      
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }
      
      throw new functions.https.HttpsError(
        'internal',
        `조회 중 오류가 발생했습니다: ${error.message}`
      );
    }
  });