# 배포 가이드

이 프로젝트는 AWS Lambda 기반으로 배포합니다. 명령은 프로젝트 루트에서 실행합니다.

## 최초 환경 구성

이미 배포된 서비스를 사용하는 경우에는 재배포할 필요가 없습니다.

### 배포 스크립트

Bash 환경(예: WSL)에서 AWS CLI 자격 증명, Terraform, Node.js/npm, zip을 준비합니다. `.env.example`을 참고해 루트의 `.env`에 OAuth 값, SerpAPI 키, Firebase 서비스 계정 파일 경로를 설정하고 Terraform S3 backend도 준비합니다.

```bash
bash infra/scripts/deploy-dev.sh
```

스크립트는 Lambda 패키지 빌드, Terraform 배포, Secrets Manager에 SerpAPI/Firebase 자격 증명 등록, Android 연결 설정 갱신을 수행합니다. 완료 후 APK를 빌드해 설치합니다. Google/Kakao 개발자 콘솔의 콜백 URL은 Terraform의 `social_provider_callback_url` 출력과 일치해야 합니다.

### GitHub Actions 배포

GitHub Actions에서 개발 환경 배포 workflow를 수동으로 실행할 수 있습니다. GitHub Actions는 Terraform을 이용한 AWS 리소스 배포를 담당하며, SerpAPI 키와 Firebase 자격 증명 등록은 로컬 deploy-dev.sh를 통해 별도로 진행합니다.

`Deploy dev` workflow에는 Android 설정 갱신과 APK 빌드가 포함되어 있지 않습니다. 배포 후 Terraform 출력으로 Android 설정을 갱신하고 APK를 다시 빌드합니다.

## 인프라 재생성 후 복구

1. Terraform S3 backend와 state 접근을 확인하고 위 배포 스크립트를 실행해 인프라와 SerpAPI/Firebase 자격 증명을 복구합니다.
2. 변경된 `social_provider_callback_url` 출력값을 Google/Kakao 개발자 콘솔의 콜백 URL에 반영합니다.
3. 스크립트가 갱신한 `android/faretrack.local.properties`를 확인합니다. GitHub Actions로 배포했다면 README의 배포 환경 연결 설정 절차에 따라 Terraform 출력값을 직접 반영합니다.
4. Android APK를 다시 빌드해 설치하고 로그인, 항공편 검색, 가격 추적 및 푸시 알림을 확인합니다.

## GitHub Actions 환경 설정

저장소의 `dev` environment에 `AWS_DEPLOY_ROLE_ARN` 변수와 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `KAKAO_CLIENT_ID`, `KAKAO_CLIENT_SECRET`, `SES_FROM_EMAIL`, `MONITORING_ALERT_EMAIL` secrets를 설정합니다. 배포 역할에는 GitHub OIDC 신뢰 설정과 Terraform 배포 및 state 접근 권한이 필요합니다.
