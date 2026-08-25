# Faretrack

항공권을 검색하고 목표 가격 또는 설정한 하락률에 도달했을 때 Android 푸시 알림을 보내는 가격 추적 서비스입니다. Kotlin Android 앱, Node.js Lambda 백엔드, AWS 서버리스 인프라로 구성되며 Terraform으로 배포합니다.

사용자는 Google 또는 Kakao 계정으로 로그인한 뒤 원하는 항공편을 검색하고 가격 추적을 등록할 수 있습니다. EventBridge가 활성화된 조건을 주기적으로 확인하며, 알림 조건을 만족하면 Firebase Cloud Messaging(FCM)으로 휴대폰 알림을 전송합니다.

## 기능

- Google 및 Kakao 소셜 로그인
- 출발지와 도착지 공항 자동완성
- 편도 및 왕복 항공편 검색
- 출발·귀국 시간과 직항 여부 조건 검색
- 가는 편과 오는 편 상세 정보 및 판매처 이동
- 목표 가격과 가격 하락률 기반 추적
- 최대 30일 가격 이력 그래프
- 중복 알림 억제 및 추가 하락 알림
- Firebase 기반 Android 푸시 알림
- Terraform 기반 AWS 인프라 관리
- GitHub Actions OIDC 기반 CI/CD
- CloudWatch 모니터링과 AWS Budgets 비용 경고

## 아키텍처

### 전체 구성

![Faretrack 전체 아키텍처](image/architecture_overall.png)

Faretrack은 별도의 EC2 서버나 VPC를 두지 않는 관리형 서버리스 구조입니다. Android 앱은 Amazon Cognito에서 발급받은 JWT로 API Gateway를 호출하고, API Lambda가 DynamoDB와 SerpApi를 이용해 항공편 검색, 가격 추적, 가격 이력을 처리합니다.

예약된 가격 확인은 사용자 요청 경로와 분리되어 있습니다. EventBridge, Scheduler Lambda, SQS, Price Worker가 비동기로 동작하므로 외부 API의 일시적인 장애가 앱 요청을 직접 중단시키지 않습니다. 알림도 별도의 SQS와 Notification Lambda로 처리합니다.

### 소셜 로그인과 API 인증

![소셜 로그인과 API 인증 흐름](image/Social_Login%20%26%20API_Authentication%20Flow.png)

1. Android 앱이 Cognito Hosted UI에 Google 또는 Kakao 로그인을 요청합니다.
2. Cognito가 선택한 소셜 제공자에게 OAuth 인증을 위임합니다.
3. 인증 성공 후 Cognito가 앱 딥 링크로 authorization code를 전달합니다.
4. Android 앱이 PKCE 검증과 함께 code를 토큰으로 교환합니다.
5. 앱이 API 요청의 `Authorization` 헤더에 JWT를 포함합니다.
6. API Gateway JWT Authorizer가 issuer, audience, 서명을 검증합니다.
7. 검증된 요청만 API Lambda로 전달되며 JWT의 사용자 식별자로 데이터 접근 범위를 제한합니다.

Android 앱에는 client secret을 저장하지 않습니다. Google/Kakao client secret과 SerpApi 키, Firebase Admin 자격 증명은 서버 측에서만 관리합니다.

### 가격 추적과 모바일 알림

![가격 추적과 알림 흐름](image/Price_Tracking%20%26%20Notification%20Flow.png)

1. EventBridge가 기본 3시간 간격으로 Scheduler Lambda를 실행합니다.
2. Scheduler Lambda가 활성 추적 조건을 Price Check SQS에 넣습니다.
3. Price Worker가 SerpApi Google Flights에서 현재 가격을 조회합니다.
4. 조회 가격과 가격 이력을 DynamoDB에 저장합니다.
5. 목표 가격 도달, 최초 하락률 도달 또는 직전 알림 이후 추가 하락 여부를 평가합니다.
6. 알림이 필요하면 Notification SQS에 메시지를 발행합니다.
7. Notification Lambda가 기기 토큰과 Firebase 자격 증명을 읽어 FCM 푸시를 전송합니다.
8. 사용자가 알림을 누르면 Android 앱의 내 가격 추적 화면으로 이동합니다.

목표 가격 알림은 조건을 처음 충족했을 때 한 번 전송합니다. 하락률 알림은 기준 하락률을 처음 충족했을 때 전송하고, 이후 조회에서 가격이 더 내려가면 다시 전송합니다. 알림 조건을 충족하지 않은 조회도 그래프를 위해 가격 이력에는 저장합니다.

### 데이터와 보안

DynamoDB는 사용자별 추적 설정, 공통 검색 조건, 가격 이력, 알림 상태, FCM 기기 토큰을 저장합니다. 동일한 검색 조건을 여러 사용자가 추적하면 정규화된 검색 키를 공유하여 외부 API 호출을 줄입니다.

Secrets Manager에는 다음 런타임 비밀값을 저장합니다.

- `faretrack-dev/serpapi`: SerpApi API 키
- `faretrack-dev/firebase`: Firebase Admin 서비스 계정 JSON

Lambda 실행 역할은 필요한 DynamoDB 테이블, SQS 큐, secret에만 접근하도록 분리합니다. Terraform state, `.env`, Firebase JSON, Android 서명 키는 Git에 포함하지 않습니다.

### CI/CD

![Faretrack CI/CD](image/architecture_cicd.png)

Pull Request와 `main` 브랜치 push에서 GitHub Actions가 Node.js 테스트, Lambda 패키지 빌드, Terraform 형식 검사와 구문 검증을 수행합니다. 개발 환경 배포는 `workflow_dispatch`로 명시적으로 실행합니다.

배포 workflow는 장기 AWS access key 대신 GitHub OIDC로 AWS 배포 역할을 인수해 임시 자격 증명을 얻습니다. 이후 원격 S3 state를 사용하는 Terraform plan과 apply를 실행합니다.

### 모니터링과 비용

Lambda 로그는 CloudWatch Logs에 저장됩니다. CloudWatch 경보는 SNS 모니터링 토픽으로 전달되며 AWS Budgets는 월별 비용을 감시합니다. 개발 환경의 기본 예산은 월 10 USD입니다.

추적 스케줄은 비용과 SerpApi 사용량을 통제하기 위해 기본적으로 비활성화되어 있습니다. 실제 주기 추적이 필요할 때만 `price_tracking_enabled = true`로 적용합니다.

## 사용 기술

### Application

![Kotlin](https://img.shields.io/badge/Kotlin-7F52FF?style=flat-square&logo=kotlin&logoColor=white)
![Android](https://img.shields.io/badge/Android-3DDC84?style=flat-square&logo=android&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js_22-339933?style=flat-square&logo=nodedotjs&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase_FCM-DD2C00?style=flat-square&logo=firebase&logoColor=white)

- Android SDK 36, minimum SDK 26
- Kotlin, Java 17, AppAuth for Android
- Node.js Lambda handlers
- Firebase Cloud Messaging
- SerpApi Google Flights

### Infrastructure

![AWS](https://img.shields.io/badge/AWS-232F3E?style=flat-square&logo=amazonwebservices&logoColor=white)
![AWS Lambda](https://img.shields.io/badge/AWS_Lambda-FF9900?style=flat-square&logo=awslambda&logoColor=white)
![DynamoDB](https://img.shields.io/badge/DynamoDB-4053D6?style=flat-square&logo=amazondynamodb&logoColor=white)
![Terraform](https://img.shields.io/badge/Terraform-844FBA?style=flat-square&logo=terraform&logoColor=white)
![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white)

- API Gateway, Cognito, Lambda, DynamoDB
- EventBridge, SQS 및 Dead Letter Queue
- Secrets Manager, CloudWatch, SNS, Budgets
- SES 이메일 fallback, S3 원격 Terraform state

## API

`/api/health`를 제외한 모든 API는 `Authorization: Bearer <JWT>` 헤더가 필요합니다.

| Method | Endpoint | 설명 |
|---|---|---|
| GET | `/api/health` | API 상태 확인 |
| POST | `/api/flights/search` | 항공편 검색 |
| POST | `/api/flights/return-options` | 가는 편에 연결되는 오는 편 조회 |
| POST | `/api/flights/booking-options` | 선택한 왕복 조합의 판매처 조회 |
| POST | `/api/devices` | FCM 기기 토큰 등록 |
| POST | `/api/alerts` | 가격 추적 등록 |
| GET | `/api/alerts` | 내 가격 추적 목록 조회 |
| PATCH | `/api/alerts/{id}` | 추적 조건 또는 상태 변경 |
| DELETE | `/api/alerts/{id}` | 가격 추적 삭제 |
| GET | `/api/history/{watchKey+}` | 가격 이력 조회 |
| POST | `/internal/price-check` | 인증된 수동 가격 확인 |

항공편 검색 요청 예시:

```json
{
  "origin": "ICN",
  "destination": "NRT",
  "departureDate": "2026-10-10",
  "returnDate": "2026-10-13",
  "tripType": "ROUND",
  "passengers": 1
}
```

## 로컬 실행

### Backend

```bash
cd /mnt/d/Lowest_airfare
npm install
npm test
npm start
```

로컬 서버의 기본 주소는 `http://localhost:3000`입니다. Android Emulator에서는 호스트 PC의 로컬 서버에 `http://10.0.2.2:3000`으로 접근합니다.

### Android

배포된 API와 Cognito 값은 `android/faretrack.local.properties`에 설정합니다. 자동 배포 스크립트는 Terraform output을 읽어 이 파일을 갱신합니다.

```powershell
cd D:\Lowest_airfare\android
.\gradlew.bat assembleDebug
```

APK는 `android/app/build/outputs/apk/debug/app-debug.apk`에 생성됩니다.

## AWS 배포

### 1. Bootstrap

최초 한 번 원격 state용 S3 버킷과 GitHub OIDC 배포 역할을 생성합니다.

```bash
cd /mnt/d/Lowest_airfare/infra/bootstrap
terraform init
terraform plan
terraform apply
terraform output
```

출력된 `github_deploy_role_arn`을 GitHub Repository Variable `AWS_DEPLOY_ROLE_ARN`으로 등록합니다.

### 2. 환경 변수

루트의 `.env.example`을 참고해 Git에 포함되지 않는 `.env`를 작성합니다.

```dotenv
TF_VAR_google_client_id=google-web-client-id
TF_VAR_google_client_secret=google-client-secret
TF_VAR_kakao_client_id=kakao-rest-api-key
TF_VAR_kakao_client_secret=kakao-client-secret
SERPAPI_API_KEY=serpapi-key
FIREBASE_SERVICE_ACCOUNT_FILE=/path/to/firebase-adminsdk.json
```

### 3. 개발 환경 배포

다음 스크립트가 환경 변수 로드, Lambda ZIP 생성, Terraform 적용, SerpApi/Firebase secret 등록, Android 설정 생성을 순서대로 처리합니다.

```bash
cd /mnt/d/Lowest_airfare
bash infra/scripts/deploy-dev.sh
```

승인 질문 없이 적용하려면 `AUTO_APPROVE=true bash infra/scripts/deploy-dev.sh`를 사용합니다.

배포 확인:

```bash
cd infra/terraform
terraform output
curl "$(terraform output -raw api_base_url)/api/health"
```

### 4. GitHub Actions 배포

GitHub의 Actions에서 개발 환경 배포 workflow를 수동 실행합니다. Repository Variable `AWS_DEPLOY_ROLE_ARN`, Google/Kakao OAuth secret, SES 발신 이메일과 모니터링 이메일 변수가 필요합니다.

GitHub Actions의 Terraform 배포와 Secrets Manager의 실제 SerpApi/Firebase 값 갱신은 별도입니다. 런타임 secret까지 한 번에 등록하려면 로컬 `deploy-dev.sh`를 사용합니다.

### 배포 중단

```bash
cd /mnt/d/Lowest_airfare/infra/terraform
terraform init -reconfigure -backend-config="environments/dev.backend.hcl"
terraform destroy -var-file="environments/dev.tfvars"
```

Bootstrap의 state 버킷과 GitHub OIDC 역할은 다음 재배포에 사용할 수 있으므로 일반적인 개발 환경 중단 시 유지합니다.

## Troubleshooting

### Lambda ZIP 생성 실패

`buildLambda.sh` 실행 중 WSL에 `zip`이 설치되어 있지 않아 Lambda 패키지 생성이 실패했습니다. `zip` 패키지를 설치한 뒤 스크립트를 다시 실행해 `backend/dist`에 배포 ZIP을 정상적으로 생성했습니다.

### WSL에서 Android APK 빌드 실패

WSL에서 Windows용 Android SDK를 사용하면서 SDK 경로와 `aapt` 오류가 발생했습니다. Android Studio에서 SDK와 Build Tools를 확인한 뒤 Windows PowerShell에서 `gradlew.bat assembleDebug`를 실행해 debug APK를 정상적으로 생성했습니다.

### Secrets Manager의 secret 값 누락

Terraform이 secret 컨테이너만 생성해 SerpApi와 Firebase 값에 `AWSCURRENT`가 없었고 가격 검색이 실패했습니다. `.env`와 Firebase 서비스 계정 JSON을 준비해 `deploy-dev.sh`를 다시 실행했으며, 실제 secret 값이 등록되어 Lambda가 자격 증명을 정상적으로 읽었습니다.

### Cognito 로그인 도메인 연결 실패

인프라를 삭제하고 다시 배포한 뒤 APK가 이전 Cognito 도메인과 client ID를 참조해 로그인 페이지가 열리지 않았습니다. 새 Terraform output으로 Android 설정과 소셜 로그인 callback URI를 갱신하고 APK를 다시 빌드해 로그인이 정상적으로 완료되도록 수정했습니다.

### Firebase 푸시 알림 전송 실패와 중복 알림

Firebase 서비스 계정 JSON 형식이 Lambda가 기대한 구조와 달라 푸시 전송이 실패했고, 이를 수정한 뒤에는 이전 알림 상태가 구분되지 않아 같은 알림이 반복됐습니다. CloudWatch 로그를 기준으로 JSON 파싱을 수정하고 DynamoDB에 목표 도달 상태와 직전 알림 가격을 저장해 최초 도달 또는 추가 하락 시에만 알림이 전송되도록 해결했습니다.

## 현재 제약 사항

- 결과와 판매처 범위는 SerpApi Google Flights 데이터에 의존하므로 네이버 항공권과 결과 수 또는 가격이 다를 수 있습니다.
- 오는 편과 판매처 조회에는 SerpApi token이 필요하며 조합에 따라 추가 요청이 발생합니다.
- 최근 30일 그래프는 공급자가 과거 정보를 제공하거나 Faretrack이 직접 수집한 이력이 있을 때만 완전하게 표시됩니다.
- SerpApi 사용량과 요금제 한도를 별도로 관리해야 합니다.
- SES fallback은 검증된 주소 또는 SES production access가 필요합니다.
- Google/Kakao 콘솔의 client 정보와 Cognito callback URI가 정확히 일치해야 합니다.
- 개발 환경의 주기 가격 추적은 비용 방지를 위해 기본적으로 꺼져 있습니다.
- 현재 산출물은 debug APK이며 Play Store용 서명과 release 설정은 별도로 구성해야 합니다.

## 개발자

- GitHub: [lty02-ops](https://github.com/lty02-ops)
- Repository: [Faretrack](https://github.com/lty02-ops/Faretrack)
