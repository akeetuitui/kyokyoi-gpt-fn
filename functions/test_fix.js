// 수정사항 검증을 위한 간단한 테스트
const admin = require("firebase-admin");

// 서비스 계정으로 초기화
const serviceAccount = require("./kyokyoi-service-account.json");
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "artlog-app-72ff1"
});

const db = admin.firestore();

async function testUserRecordMapping() {
  const testUserId = "9nxjNERspFYYa1rSmUNfeW1k8yt1";
  
  console.log("🧪 수정된 필드 매핑 테스트 중...");
  
  try {
    const recordsRef = db.collection("users")
      .doc(testUserId)
      .collection("now_records")
      .limit(1);
    
    const snapshot = await recordsRef.get();
    
    if (!snapshot.empty) {
      snapshot.forEach((doc) => {
        const data = doc.data();
        
        // 수정된 필드 매핑 테스트
        const exhibitionName = data.exhibition_title ||    // 실제 필드명
                               data.exhibitionTitle ||     // 이전 호환성
                               "미상";
                               
        const artistName = data.selected_artist ||         // 실제 필드명
                          data.selectedArtist ||           // 이전 호환성
                          "미상";
                          
        const reviewText = data.inspiration || "";         // 실제 필드명
        
        const visitDate = data.visit_date ||               // 실제 필드명
                         data.visitDate ||                 // 이전 호환성
                         "미상";
        
        console.log("✅ 매핑 테스트 결과:");
        console.log(`  📋 전시명: "${exhibitionName}" (필드 발견 여부: ${data.exhibition_title ? "✅ 있음" : "❌ 없음"})`);
        console.log(`  👨‍🎨 작가명: "${artistName}" (필드 발견 여부: ${data.selected_artist ? "✅ 있음" : "❌ 없음"})`);
        console.log(`  📝 감상문: "${reviewText.substring(0, 30)}..." (${reviewText.length}자)`);
        console.log(`  📅 방문일: "${visitDate}" (필드 발견 여부: ${data.visit_date ? "✅ 있음" : "❌ 없음"})`);
        
        // 검증 통과 여부 확인 (3자 이상)
        const wouldPass = reviewText && reviewText.trim().length >= 3;
        console.log(`  🎯 검증 통과 여부: ${wouldPass ? "✅ 통과" : "❌ 실패"}`);
        
        console.log("\n📊 실제 필드명 비교:");
        console.log(`  exhibition_title: "${data.exhibition_title || "없음"}"`);
        console.log(`  exhibitionTitle: "${data.exhibitionTitle || "없음"}"`);
        console.log(`  selected_artist: "${data.selected_artist || "없음"}"`);
        console.log(`  selectedArtist: "${data.selectedArtist || "없음"}"`);
      });
    } else {
      console.log("❌ 기록을 찾을 수 없음");
    }
    
  } catch (error) {
    console.error("🚨 테스트 실패:", error);
  }
  
  console.log("\n🏁 테스트 완료");
  process.exit(0);
}

testUserRecordMapping().catch(console.error);
