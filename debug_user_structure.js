// 🔍 Debug script to investigate user data structure issue
// This script will help us understand why user 9nxjNERspFYYa1rSmUNfeW1k8yt1 gets "Firestore 컬렉션을 찾을 수 없습니다"

const admin = require("firebase-admin");

// Initialize Firebase Admin (using the same project as our functions)
admin.initializeApp();
const db = admin.firestore();

async function debugUserStructure() {
  const testUserId = "9nxjNERspFYYa1rSmUNfeW1k8yt1";
  
  console.log(`🔍 Debug: 사용자 ${testUserId} 데이터 구조 조사`);
  console.log("=====================================");

  try {
    // 1. 사용자 문서 존재 확인
    console.log("\n1️⃣ 사용자 문서 확인:");
    const userDocRef = db.collection("users").doc(testUserId);
    const userDoc = await userDocRef.get();
    
    if (userDoc.exists) {
      console.log(`✅ 사용자 문서 발견: users/${testUserId}`);
      console.log("📄 사용자 문서 데이터:", JSON.stringify(userDoc.data(), null, 2));
      
      // 2. 하위 컬렉션 목록 조회
      console.log("\n2️⃣ 하위 컬렉션 조사:");
      const subcollections = await userDocRef.listCollections();
      console.log(`📁 하위 컬렉션 개수: ${subcollections.length}`);
      
      for (const subcollection of subcollections) {
        console.log(`📂 하위 컬렉션: ${subcollection.id}`);
        
        // 각 하위 컬렉션의 문서들 조회
        const snapshot = await subcollection.limit(5).get();
        console.log(`  📄 문서 개수: ${snapshot.size}`);
        
        if (!snapshot.empty) {
          snapshot.forEach((doc, index) => {
            if (index < 2) { // 처음 2개만 상세 정보
              const data = doc.data();
              console.log(`  📋 문서 ${index + 1} (${doc.id}):`);
              console.log(`    - 필드: ${Object.keys(data).join(", ")}`);
              console.log(`    - 감상문: ${data.inspiration ? `"${data.inspiration.substring(0, 30)}..."` : "없음"}`);
              console.log(`    - 전시명: ${data.exhibitionTitle || data.exhibition_name || "없음"}`);
              console.log(`    - 작가명: ${data.selectedArtist || data.artistName || "없음"}`);
            }
          });
        }
      }
    } else {
      console.log(`❌ 사용자 문서 없음: users/${testUserId}`);
      
      // 3. 다른 가능한 컬렉션 구조 확인
      console.log("\n3️⃣ 대체 컬렉션 구조 조사:");
      const possibleCollections = ["Users", "user", "USER"];
      
      for (const collectionName of possibleCollections) {
        try {
          const altUserDoc = await db.collection(collectionName).doc(testUserId).get();
          if (altUserDoc.exists) {
            console.log(`✅ 발견: ${collectionName}/${testUserId}`);
            console.log("📄 데이터:", JSON.stringify(altUserDoc.data(), null, 2));
          } else {
            console.log(`❌ 없음: ${collectionName}/${testUserId}`);
          }
        } catch (error) {
          console.log(`⚠️ ${collectionName} 조회 실패: ${error.message}`);
        }
      }
      
      // 4. uid 필드로 검색
      console.log("\n4️⃣ uid 필드로 사용자 검색:");
      try {
        const uidQuery = await db.collection("users").where("uid", "==", testUserId).limit(3).get();
        if (!uidQuery.empty) {
          console.log(`✅ uid 필드로 발견: ${uidQuery.size}개`);
          uidQuery.forEach((doc) => {
            console.log(`📄 문서 ID: ${doc.id}`);
            console.log("📋 데이터:", JSON.stringify(doc.data(), null, 2));
          });
        } else {
          console.log("❌ uid 필드로도 찾을 수 없음");
        }
      } catch (error) {
        console.log(`⚠️ uid 검색 실패: ${error.message}`);
      }
    }
    
    // 5. users 컬렉션 전체 샘플 조회
    console.log("\n5️⃣ users 컬렉션 샘플 조회:");
    try {
      const allUsersSnapshot = await db.collection("users").limit(5).get();
      console.log(`📊 users 컬렉션 전체 문서 수 (상위 5개): ${allUsersSnapshot.size}`);
      
      allUsersSnapshot.forEach((doc, index) => {
        console.log(`👤 사용자 ${index + 1}: ${doc.id}`);
        const userData = doc.data();
        console.log(`  - 이메일: ${userData.email || "없음"}`);
        console.log(`  - 생성일: ${userData.createdAt || userData.created_at || "없음"}`);
        console.log(`  - 필드: ${Object.keys(userData).join(", ")}`);
      });
    } catch (error) {
      console.log(`⚠️ 전체 사용자 조회 실패: ${error.message}`);
    }
    
    // 6. 특정 사용자와 유사한 패턴 검색
    console.log("\n6️⃣ 유사 사용자 ID 패턴 검색:");
    try {
      // testUserId의 첫 부분과 유사한 패턴 찾기
      const userIdPrefix = testUserId.substring(0, 10); // 처음 10자
      console.log(`🔍 검색 패턴: ${userIdPrefix}*`);
      
      const allUsers = await db.collection("users").limit(20).get();
      const similarUsers = [];
      
      allUsers.forEach((doc) => {
        if (doc.id.startsWith(userIdPrefix.substring(0, 5))) { // 처음 5자 일치
          similarUsers.push(doc.id);
        }
      });
      
      if (similarUsers.length > 0) {
        console.log(`✅ 유사 패턴 사용자 발견: ${similarUsers.length}개`);
        similarUsers.forEach((id) => {
          console.log(`  📝 ${id}`);
        });
      } else {
        console.log("❌ 유사 패턴 사용자 없음");
      }
    } catch (error) {
      console.log(`⚠️ 패턴 검색 실패: ${error.message}`);
    }
    
  } catch (error) {
    console.error("🚨 전체 디버그 실패:", error);
  }
  
  console.log("\n🏁 디버그 조사 완료");
  process.exit(0);
}

// 스크립트 실행
debugUserStructure().catch(console.error);
