// kyokyoi-gpt-fn/functions/index.js (필드명 매핑 수정)

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { analyzeTasterType, structureAnalysisResult } = require("./services/analyzeTasterType");

// Firebase Admin 초기화
admin.initializeApp();
const db = admin.firestore();

/**
 * 사용자의 NOW 기록 가져오기 (Flutter 필드명과 정확히 매핑)
 */
async function getUserNowRecords(userId) {
  try {
    console.log(`[getUserNowRecords] 사용자 ${userId}의 기록 조회 시작`);

    const recordsRef = db.collection("users")
      .doc(userId)
      .collection("now_records")  // ✅ Flutter와 정확히 일치
      .orderBy("created_at", "desc")  // ✅ created_at으로 정렬
      .limit(20); // 최대 20개까지 조회

    const snapshot = await recordsRef.get();
    console.log(`[getUserNowRecords] Firestore에서 ${snapshot.size}개 문서 조회됨`);

    const records = [];
    snapshot.forEach((doc) => {
      const data = doc.data();

      // ✅ Flutter ExhibitionRecord 모델과 정확히 매핑
      const exhibitionName = data.exhibitionTitle || data.exhibition_name || "미상";
      const artistName = data.artistName || data.artist_name || "미상";
      
      // ✅ 감상문 필드 정확한 매핑 (Flutter에서 사용하는 필드명)
      const reviewText = data.inspirationText || // ✅ 주요 필드
                         data.review_text || 
                         data.reviewText ||
                         data.comment || 
                         data.memo || "";

      // ✅ 방문일 처리 (Flutter 필드명과 매핑)
      let visitDate = "미상";
      if (data.visit_date || data.visitDate) {
        const dateField = data.visit_date || data.visitDate;
        visitDate = dateField.toDate
          ? dateField.toDate().toISOString().split("T")[0]
          : dateField;
      }

      // 감상문이 유의미하게 있는 기록만 포함 (최소 3자 이상)
      if (reviewText && reviewText.trim().length >= 3) {
        records.push({
          id: doc.id,
          exhibition_name: exhibitionName,
          artist_name: artistName,
          review_text: reviewText.trim(),
          visit_date: visitDate,
          created_at: data.created_at
            ? (data.created_at.toDate
              ? data.created_at.toDate().toISOString()
              : data.created_at)
            : "미상",
        });
        
        console.log(`[getUserNowRecords] ✅ 유효한 기록 추가: ${exhibitionName} (감상문 ${reviewText.length}자)`);
      } else {
        console.log(`[getUserNowRecords] ❌ 감상문 부족으로 제외: ${doc.id} (${exhibitionName})`);
        console.log(`[getUserNowRecords] 📝 감상문 내용: "${reviewText}" (길이: ${reviewText.length})`);
      }
    });

    console.log(`[getUserNowRecords] ✅ ${records.length}개 유효한 기록 조회 완료`);

    // 샘플 로그 (첫 번째 기록)
    if (records.length > 0) {
      console.log("[getUserNowRecords] 📋 첫 번째 기록 샘플:", {
        exhibition: records[0].exhibition_name,
        artist: records[0].artist_name,
        review_length: records[0].review_text.length,
        review_preview: records[0].review_text.substring(0, 30) + "...",
        visit_date: records[0].visit_date,
      });
    }

    return records;
  } catch (error) {
    console.error("[getUserNowRecords] ❌ 기록 조회 실패:", error);
    throw error;
  }
}

/**
 * GPT 응답 검증 및 파싱 (기존과 동일)
 */
function validateAndParseGPTResponse(gptResponse) {
  try {
    // JSON 마크다운 제거
    let cleanResponse = gptResponse;
    if (cleanResponse.includes("```json")) {
      cleanResponse = cleanResponse.replace(/```json/g, "").replace(/```/g, "").trim();
    }

    // JSON 파싱
    const parsed = JSON.parse(cleanResponse);

    // 필수 필드 검증
    const requiredFields = ["primary_type", "confidence", "analysis"];
    for (const field of requiredFields) {
      if (!parsed[field]) {
        throw new Error(`필수 필드 누락: ${field}`);
      }
    }

    // 유형 검증
    const validTypes = ["AF", "AC", "IF", "IC", "XX"];
    if (!validTypes.includes(parsed.primary_type)) {
      console.warn(`[validateGPT] 잘못된 유형 ${parsed.primary_type}, XX로 변경`);
      parsed.primary_type = "XX";
    }

    // 신뢰도 검증
    const validConfidence = ["상", "중", "하"];
    if (!validConfidence.includes(parsed.confidence)) {
      console.warn(`[validateGPT] 잘못된 신뢰도 ${parsed.confidence}, 중으로 변경`);
      parsed.confidence = "중";
    }

    return {
      success: true,
      data: parsed,
    };
  } catch (error) {
    console.error("[validateGPT] 응답 파싱 실패:", error);
    return {
      success: false,
      error: "PARSE_ERROR",
      message: `GPT 응답 파싱 실패: ${error.message}`,
    };
  }
}

/**
 * 결과를 Firebase에 저장
 */
async function saveTasterTypeResult(userId, result) {
  try {
    console.log(`[saveTasterType] 사용자 ${userId} 결과 저장 시작`);

    // users/{userId}/taster_analysis 문서에 저장
    const analysisRef = db.collection("users")
      .doc(userId)
      .collection("taster_analysis")
      .doc("latest");

    await analysisRef.set(result);

    // users/{userId} 문서에도 요약 정보 저장 (선택사항)
    const userRef = db.collection("users").doc(userId);
    await userRef.update({
      taster_type: {
        artist_type: result.artist_type,
        artist_name: result.artist_name,
        modal_type: result.modal_type,
        confidence: result.confidence,
        analyzed_at: admin.firestore.Timestamp.now(),
        has_analysis: true,
      },
    });

    console.log(`[saveTasterType] ✅ 저장 완료: ${result.artist_type} (${result.artist_name})`);
  } catch (error) {
    console.error("[saveTasterType] ❌ 저장 실패:", error);
    throw error;
  }
}

/**
 * 기존 분석 결과 확인
 */
async function getExistingAnalysis(userId) {
  try {
    const analysisRef = db.collection("users")
      .doc(userId)
      .collection("taster_analysis")
      .doc("latest");

    const doc = await analysisRef.get();

    if (doc.exists) {
      const data = doc.data();

      // 24시간 이내 결과면 재사용
      const analyzedAt = new Date(data.analyzed_at);
      const hoursAgo = (Date.now() - analyzedAt.getTime()) / (1000 * 60 * 60);

      if (hoursAgo < 24) {
        console.log(`[getExisting] ♻️ 기존 결과 재사용 (${hoursAgo.toFixed(1)}시간 전)`);
        return data;
      } else {
        console.log(`[getExisting] ⏰ 기존 결과 만료 (${hoursAgo.toFixed(1)}시간 전) - 새로 분석 필요`);
      }
    }

    return null;
  } catch (error) {
    console.error("[getExisting] ❌ 기존 결과 확인 실패:", error);
    return null;
  }
}

/**
 * 🎯 메인 분석 함수
 */
exports.analyzeTasterType = functions
  .region("asia-northeast3") // 서울 리전
  .runWith({
    timeoutSeconds: 120, // 2분으로 증가 (GPT 분석 시간 고려)
    memory: "512MB",
  })
  .https.onCall(async (data, context) => {
    try {
      // 인증 확인
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "로그인이 필요합니다.",
        );
      }

      const userId = context.auth.uid;
      console.log(`[analyzeTasterType] 🎯 사용자 ${userId} 분석 요청`);

      // 1. 기존 분석 결과 확인
      const existingResult = await getExistingAnalysis(userId);
      if (existingResult) {
        console.log("[analyzeTasterType] ♻️ 기존 결과 반환");
        return {
          success: true,
          result: existingResult,
          from_cache: true,
        };
      }

      // 2. 사용자 기록 조회
      const records = await getUserNowRecords(userId);

      if (records.length < 3) {
        console.log(`[analyzeTasterType] ❌ 기록 부족: ${records.length}개`);
        throw new functions.https.HttpsError(
          "failed-precondition",
          `분석을 위해 최소 3개의 의미있는 감상 기록이 필요합니다. (현재: ${records.length}개)\n\n감상문이 3자 이상인 기록만 분석에 사용됩니다.`,
        );
      }

      console.log(`[analyzeTasterType] ✅ 분석 대상 기록: ${records.length}개`);

      // 3. GPT 분석 실행
      const gptResponse = await analyzeTasterType(records);

      // 4. 응답 검증
      const validationResult = validateAndParseGPTResponse(gptResponse);
      if (!validationResult.success) {
        throw new functions.https.HttpsError(
          "internal",
          validationResult.message,
        );
      }

      // 5. 결과 구조화
      const finalResult = structureAnalysisResult(userId, validationResult.data, records);

      // 6. Firebase 저장
      await saveTasterTypeResult(userId, finalResult);

      console.log(`[analyzeTasterType] ✅ 분석 완료: ${finalResult.artist_type} (${finalResult.artist_name})`);
      console.log(`[analyzeTasterType] 🎭 모달 타입: ${finalResult.modal_type}, 신뢰도: ${finalResult.confidence}`);

      return {
        success: true,
        result: finalResult,
        from_cache: false,
      };
    } catch (error) {
      console.error("[analyzeTasterType] ❌ 분석 실패:", error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        "internal",
        `분석 중 오류가 발생했습니다: ${error.message}`,
      );
    }
  });

/**
 * 사용자의 분석 결과 조회 함수
 */
exports.getTasterType = functions
  .region("asia-northeast3")
  .https.onCall(async (data, context) => {
    try {
      if (!context.auth) {
        throw new functions.https.HttpsError(
          "unauthenticated",
          "로그인이 필요합니다.",
        );
      }

      const userId = context.auth.uid;
      const result = await getExistingAnalysis(userId);

      if (!result) {
        throw new functions.https.HttpsError(
          "not-found",
          "분석 결과가 없습니다. 먼저 분석을 진행해주세요.",
        );
      }

      console.log(`[getTasterType] ✅ 기존 결과 조회 성공: ${result.artist_type}`);

      return {
        success: true,
        result: result,
      };
    } catch (error) {
      console.error("[getTasterType] ❌ 조회 실패:", error);

      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      throw new functions.https.HttpsError(
        "internal",
        `조회 중 오류가 발생했습니다: ${error.message}`,
      );
    }
  });

// REST API 방식도 동일하게 수정
const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors({ origin: true }));
app.use(express.json());

app.post("/analyze-taster", async (req, res) => {
  try {
    const { user_id, records } = req.body;

    if (!user_id || !Array.isArray(records) || records.length < 3) {
      return res.status(400).json({
        error: "user_id가 없거나 records가 3개 이상 필요합니다.",
      });
    }

    console.log(`[REST /analyze-taster] 분석 요청 시작: ${user_id} (${records.length}개 기록)`);

    const gptResponse = await analyzeTasterType(records);
    const validationResult = validateAndParseGPTResponse(gptResponse);

    if (!validationResult.success) {
      return res.status(500).json({
        error: "GPT 응답 파싱 실패",
        message: validationResult.message,
        raw: gptResponse,
      });
    }

    const finalResult = structureAnalysisResult(user_id, validationResult.data, records);
    await saveTasterTypeResult(user_id, finalResult);

    return res.status(200).json({
      success: true,
      result: finalResult,
    });
  } catch (err) {
    console.error("[REST /analyze-taster] 오류 발생:", err);
    return res.status(500).json({
      error: "분석 실패",
      message: err.message,
    });
  }
});

exports.api = functions.region("asia-northeast3").https.onRequest(app);