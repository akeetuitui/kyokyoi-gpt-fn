# 🔧 Cross-Project Firestore 설정 가이드

## 개요
kyokyoi-gpt-fn 프로젝트에서 kyokyoi 프로젝트의 Firestore 데이터에 접근하기 위한 설정 가이드입니다.

## 📋 설정 단계

### 1. kyokyoi 프로젝트에서 서비스 계정 키 발급

1. **Google Cloud Console** 접속
   - https://console.cloud.google.com
   - kyokyoi 프로젝트 선택

2. **IAM & Admin > 서비스 계정** 메뉴로 이동

3. **서비스 계정 생성 또는 기존 계정 선택**
   - 새로 생성하는 경우: "서비스 계정 만들기" 클릭
   - 이름: `kyokyoi-gpt-fn-access`
   - 설명: `kyokyoi-gpt-fn에서 데이터 읽기용`

4. **권한 설정**
   - 역할 추가: `Cloud Datastore User` 또는 `Firebase Admin SDK Administrator Service Agent`
   - 최소 권한: `roles/datastore.user`

5. **키 생성**
   - 서비스 계정 > "키" 탭 > "키 추가" > "새 키 만들기"
   - 유형: **JSON** 선택
   - 생성 후 자동 다운로드됨

### 2. 키 파일 배치

다운로드된 JSON 파일을 다음 위치에 배치:
```
kyokyoi-gpt-fn/functions/kyokyoi-service-account.json
```

⚠️ **중요**: 이 파일은 절대 Git에 커밋하면 안됩니다! (.gitignore에 이미 추가됨)

### 3. 파일 내용 확인

`kyokyoi-service-account.json` 파일이 다음과 같은 구조인지 확인:
```json
{
  "type": "service_account",
  "project_id": "kyokyoi",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "...@kyokyoi.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

### 4. 배포 및 테스트

```bash
cd functions
firebase deploy --only functions
```

배포 후 로그에서 연결 상태 확인:
```
[Firebase] ✅ kyokyoi 프로젝트 연결 성공
```

## 🔒 보안 주의사항

1. **서비스 계정 키 관리**
   - 키 파일을 절대 공개 저장소에 업로드하지 마세요
   - 정기적으로 키를 교체하세요 (3-6개월마다)
   - 불필요한 권한은 부여하지 마세요

2. **접근 제어**
   - 최소 권한 원칙 적용
   - 로그 모니터링으로 비정상 접근 감지

3. **키 유출 시 대응**
   - 즉시 해당 서비스 계정 키 삭제
   - 새로운 키 생성 및 교체
   - 액세스 로그 점검

## 🔍 트러블슈팅

### 연결 실패 시
```
[Firebase] ❌ kyokyoi 프로젝트 연결 실패
```

**해결 방법:**
1. `kyokyoi-service-account.json` 파일 존재 확인
2. JSON 형식 유효성 검사
3. 서비스 계정 권한 확인
4. 프로젝트 ID 일치 확인

### 데이터 읽기 실패 시
```
[getUserNowRecords] ❌ kyokyoi 프로젝트 기록 조회 실패
```

**해결 방법:**
1. Firestore 규칙 확인
2. 서비스 계정 권한 재확인
3. 컬렉션/문서 경로 확인

## 📊 데이터 흐름

```
kyokyoi 앱 (Flutter)
    ↓ 사용자 기록 저장
kyokyoi Firestore
    ↓ 서비스 계정으로 읽기
kyokyoi-gpt-fn Functions
    ↓ GPT 분석 후 저장
kyokyoi & kyokyoi-gpt-fn Firestore
    ↓ 결과 조회
kyokyoi 앱 (Flutter)
```
