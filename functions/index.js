// kyokyoi-gpt-fn/functions/index.js (artlog-app-72ff1 프로젝트에 배포)

const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { analyzeTasterType, structureAnalysisResult } = require("./services/analyzeTasterType");

// 🔧 Firebase Admin 초기화 (단일 프로젝트 - artlog-app-72ff1)
admin.initializeApp();
const db = admin.firestore(); // artlog-app-72ff1 DB (데이터와 같은 프로젝트)
const auth = admin.auth(); // artlog-app-72ff1 Auth

console.log("[Firebase] ✅ artlog-app-72ff1 프로젝트 초기화 완료 (데이터와 Functions 동일 프로젝트)");

/**
 * 토큰 검증 (같은 프로젝트이므로 간단)
 */
async function verifyIdToken(token) {
  console.log(`[verifyToken] 🔍 토큰 검증 시작 (길이: ${token ? token.length : 0})`);

  if (!token || typeof token !== "string") {
    throw new Error("유효하지 않은 토큰 형식");
  }

  try {
    const decodedToken = await auth.verifyIdToken(token);
    console.log(`[verifyToken] ✅ 토큰 검증 성공: ${decodedToken.uid}`);
    console.log(`[verifyToken] 📋 토큰 정보: 발급자=${decodedToken.iss}, 대상=${decodedToken.aud}`);
    return decodedToken;
  } catch (error) {
    console.error(`[verifyToken] ❌ 토큰 검증 실패: ${error.message}`);
    throw new Error(`토큰 검증 실패: ${error.message}`);
  }
}

/**
 * 사용자의 NOW 기록 가져오기 (같은 프로젝트이므로 직접 접근)
 */
async function getUserNowRecords(userId) {
  try {
    console.log(`[getUserNowRecords] 🔍 사용자 ${userId}의 기록 조회 시작`);

    // Firestore 쿼리 실행 (같은 프로젝트이므로 직접 접근)
    const recordsRef = db.collection("users")
      .doc(userId)
      .collection("now_records")
      .orderBy("createdAt", "desc")
      .limit(20);

    console.log(`[getUserNowRecords] 📋 쿼리 경로: users/${userId}/now_records`);

    let snapshot;
    try {
      snapshot = await recordsRef.get();
      console.log(`[getUserNowRecords] 📊 ${snapshot.size}개 문서 조회됨`);
    } catch (firestoreError) {
      console.error("[getUserNowRecords] ❌ Firestore 쿼리 실패:", {
        code: firestoreError.code,
        message: firestoreError.message,
        details: firestoreError.details || "없음",
      });
      throw new Error(`Firestore 조회 실패: ${firestoreError.message} (코드: ${firestoreError.code})`);
    }

    if (snapshot.empty) {
      console.log(`[getUserNowRecords] ⚠️ 사용자 ${userId}의 기록이 없음`);
      return [];
    }

    const records = [];
    snapshot.forEach((doc) => {
      const data = doc.data();

      // artlog-app-72ff1 Flutter 앱의 ExhibitionRecord 모델과 매핑
      const exhibitionName = data.exhibitionTitle || data.exhibition_name || data.title || "미상";

      // 작가명 추출 (selectedArtist 또는 artistGenres에서)
      let artistName = "미상";
      if (data.selectedArtist && data.selectedArtist.trim()) {
        artistName = data.selectedArtist;
      } else if (data.artistGenres && Array.isArray(data.artistGenres) &&
                 data.artistGenres.length > 0) {
        // artistGenres에서 첫 번째 작가명 추출
        const firstArtist = data.artistGenres[0];
        if (firstArtist && firstArtist.artistName) {
          artistName = firstArtist.artistName;
        }
      } else if (data.artistName || data.artist_name) {
        artistName = data.artistName || data.artist_name;
      }

      // 감상문 필드 정확한 매핑 (artlog-app-72ff1 앱에서 사용하는 필드명)
      const reviewText = data.inspiration || // 주요 필드 (ExhibitionRecord 모델)
                         data.inspirationText ||
                         data.review_text ||
                         data.reviewText ||
                         data.comment ||
                         data.memo || "";

      // 방문일 처리 (ExhibitionRecord 모델의 visitDate 필드)
      let visitDate = "미상";
      if (data.visitDate || data.visit_date) {
        const dateField = data.visitDate || data.visit_date;
        if (dateField && dateField.toDate) {
          // Firestore Timestamp
          visitDate = dateField.toDate().toISOString().split("T")[0];
        } else if (dateField) {
          // 이미 문자열이거나 다른 형식
          visitDate = dateField.toString().split("T")[0];
        }
      } else if (data.createdAt) {
        // visitDate가 없으면 createdAt 사용
        const createdAt = data.createdAt;
        if (createdAt && createdAt.toDate) {
          visitDate = createdAt.toDate().toISOString().split("T")[0];
        } else if (createdAt) {
          visitDate = createdAt.toString().split("T")[0];
        }
      }

      // 감상문이 유의미하게 있는 기록만 포함 (최소 3자 이상)
      if (reviewText && reviewText.trim().length >= 3) {
        records.push({
          id: doc.id,
          exhibition_name: exhibitionName,
          artist_name: artistName,
          review_text: reviewText.trim(),
          visit_date: visitDate,
          created_at: data.createdAt
            ? (data.createdAt.toDate
              ? data.createdAt.toDate().toISOString()
              : data.createdAt.toString())
            : (data.created_at
              ? (data.created_at.toDate
                ? data.created_at.toDate().toISOString()
                : data.created_at.toString())
              : "미상"),
        });

        console.log(
          `[getUserNowRecords] ✅ 유효한 기록 추가: ${exhibitionName} (감상문 ${reviewText.length}자)`,
        );
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
    console.error("[getUserNowRecords] ❌ 기록 조회 실패:", {
      message: error.message,
      code: error.code || "없음",
      details: error.details || "없음",
      stack: error.stack?.split("\n").slice(0, 3).join("\n"), // 스택 트레이스 일부만
    });

    // 더 구체적인 오류 메시지 제공
    if (error.message.includes("NOT_FOUND") || error.code === 5) {
      const userIdShort = userId ? userId.substring(0, 8) + "..." : "없음";
      throw new Error(
        `사용자 데이터 조회 실패: 사용자 데이터를 찾을 수 없습니다. 사용자 ID: ${userIdShort}`,
      );
    } else if (error.message.includes("PERMISSION_DENIED")) {
      throw new Error("권한 오류: Firestore 접근 권한이 없습니다.");
    } else {
      throw new Error(`기록 조회 실패: ${error.message}`);
    }
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
 * 분석 결과 저장 (같은 프로젝트이므로 단순)
 */
async function saveTasterTypeResult(userId, result) {
  try {
    console.log(`[saveTasterType] 사용자 ${userId} 결과 저장 시작`);

    // artlog-app-72ff1 프로젝트에 저장 (데이터와 Functions가 같은 프로젝트)
    const analysisRef = db.collection("users")
      .doc(userId)
      .collection("taster_analysis")
      .doc("latest");

    await analysisRef.set(result);
    console.log("[saveTasterType] ✅ 분석 결과 저장 완료");

    // users/{userId} 문서에도 요약 정보 저장
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

    console.log(`[saveTasterType] 🎯 최종 저장 완료: ${result.artist_type} (${result.artist_name})`);
  } catch (error) {
    console.error("[saveTasterType] ❌ 저장 실패:", error);
    throw error;
  }
}

/**
 * 기존 분석 결과 확인 (같은 프로젝트이므로 단순)
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
      const analyzedAt = new Date(data.analyzed_at);
      const hoursAgo = (Date.now() - analyzedAt.getTime()) / (1000 * 60 * 60);

      if (hoursAgo < 24) {
        console.log(`[getExisting] ♻️ 기존 결과 재사용 (${hoursAgo.toFixed(1)}시간 전)`);
        return data;
      } else {
        console.log(`[getExisting] ⏰ 기존 결과 만료 (${hoursAgo.toFixed(1)}시간 전)`);
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
    console.log("[analyzeTasterType] 🚀 함수 호출 시작");
    console.log("[analyzeTasterType] 📋 데이터:", JSON.stringify(data || {}, null, 2));
    console.log("[analyzeTasterType] 🔍 Context 정보:", {
      hasAuth: !!context.auth,
      uid: context.auth?.uid || "없음",
      email: context.auth?.token?.email || "없음",
      iss: context.auth?.token?.iss || "없음",
      aud: context.auth?.token?.aud || "없음",
      projectId: context.auth?.token?.firebase?.sign_in_provider || "없음",
    });

    try {
      // 인증 확인 - 다중 프로젝트 지원
      if (!context.auth) {
        console.error("[analyzeTasterType] ❌ 인증 정보 없음");
        throw new functions.https.HttpsError(
          "unauthenticated",
          "로그인이 필요합니다.",
        );
      }

      const userId = context.auth.uid;
      console.log(`[analyzeTasterType] 🎯 사용자 ${userId} 분석 요청`);
      console.log(`[analyzeTasterType] 🔐 토큰 발급자: ${context.auth.token.iss || "unknown"}`);
      console.log(`[analyzeTasterType] 📱 토큰 대상 앱: ${context.auth.token.aud || "unknown"}`);

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

      console.log(
        `[analyzeTasterType] ✅ 분석 완료: ${finalResult.artist_type} (${finalResult.artist_name})`,
      );
      console.log(
        `[analyzeTasterType] 🎭 모달 타입: ${finalResult.modal_type}, 신뢰도: ${finalResult.confidence}`,
      );

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
  console.log("[REST /analyze-taster] 🚀 REST API 호출 시작");
  console.log("[REST /analyze-taster] 📋 요청 헤더:", {
    "content-type": req.headers["content-type"],
    "authorization": req.headers.authorization ?
      `Bearer ${req.headers.authorization.substring(7, 20)}...` : "없음",
    "user-agent": req.headers["user-agent"],
    "origin": req.headers.origin || "없음",
  });

  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[REST /analyze-taster] ❌ Authorization 헤더 누락 또는 잘못됨:", authHeader);
      return res.status(401).json({
        error: "UNAUTHENTICATED",
        message: "Authorization 헤더가 필요합니다.",
      });
    }

    const idToken = authHeader.split("Bearer ")[1];
    console.log(`[REST /analyze-taster] 🔑 토큰 추출 성공 (길이: ${idToken.length})`);

    // 토큰 검증
    let decodedToken;
    try {
      decodedToken = await verifyIdToken(idToken);
      console.log(`[REST /analyze-taster] 🔐 토큰 검증 성공: ${decodedToken.uid}`);
      console.log(
        `[REST /analyze-taster] 📋 토큰 정보: 발급자=${decodedToken.iss}, 대상=${decodedToken.aud}`,
      );
    } catch (authError) {
      console.error(`[REST /analyze-taster] ❌ 토큰 검증 실패: ${authError.message}`);
      return res.status(401).json({
        error: "UNAUTHENTICATED",
        message: `유효하지 않은 토큰입니다: ${authError.message}`,
        details: authError.message,
      });
    }

    const userId = decodedToken.uid;
    console.log(`[REST /analyze-taster] 👤 사용자 ID 확인: ${userId}`);

    const { records } = req.body;
    console.log(`[REST /analyze-taster] 📊 요청 바디에서 받은 기록 수: ${records ? records.length : 0}`);

    // 기존 분석 결과 확인
    const existingResult = await getExistingAnalysis(userId);
    if (existingResult) {
      console.log(`[REST /analyze-taster] ♻️ 기존 결과 반환: ${userId}`);
      return res.status(200).json({
        success: true,
        result: existingResult,
        from_cache: true,
      });
    }

    // 사용자 기록 조회 (같은 프로젝트에서)
    const userRecords = await getUserNowRecords(userId);

    if (userRecords.length < 3) {
      return res.status(400).json({
        error: "FAILED_PRECONDITION",
        message: `분석을 위해 최소 3개의 의미있는 감상 기록이 필요합니다. (현재: ${userRecords.length}개)`,
      });
    }

    console.log(`[REST /analyze-taster] 분석 요청 시작: ${userId} (${userRecords.length}개 기록)`);

    const gptResponse = await analyzeTasterType(userRecords);
    const validationResult = validateAndParseGPTResponse(gptResponse);

    if (!validationResult.success) {
      return res.status(500).json({
        error: "GPT 응답 파싱 실패",
        message: validationResult.message,
        raw: gptResponse,
      });
    }

    const finalResult = structureAnalysisResult(userId, validationResult.data, userRecords);
    await saveTasterTypeResult(userId, finalResult);

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