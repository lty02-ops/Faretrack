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

## Jenkins 설정

Linux 에이전트에 Git, Bash, Node.js 22/npm, zip, Terraform 1.15.8을 설치합니다. 배포 에이전트에는 AWS CLI도 필요합니다. Pipeline(Declarative 포함), Git, GitHub Branch Source, Credentials Binding 플러그인을 설치합니다.

### CI

1. GitHub 저장소를 연결한 Multibranch Pipeline을 생성하고 Script Path를 `Jenkinsfile`로 설정합니다.
2. `main`과 PR 검색을 활성화합니다. 이름 필터 사용 시 `main PR-*`를 포함합니다.
3. GitHub webhook에 `https://<jenkins-host>/github-webhook/`을 등록하고 push, pull request 이벤트를 활성화합니다. 외부 접근이 어려우면 주기적인 저장소 스캔을 설정합니다.
4. `faretrack-ci` 라벨의 에이전트를 등록합니다. AWS 배포 권한과 배포 자격 증명은 제공하지 않습니다.

외부 fork PR은 신뢰 정책에 따라 승인 후 실행합니다. PR이 배포 에이전트를 사용할 수 없도록 노드 및 작업 접근 권한을 제한합니다. 라벨만으로는 보안 경계가 되지 않습니다. GitHub 필수 상태 검사를 사용한다면 기존 Actions 검사도 Jenkins 검사로 변경합니다.

### 수동 개발 환경 배포

1. 별도 배포 폴더에 `faretrack-deploy-dev` Pipeline 작업을 하나만 생성합니다. Multibranch 작업으로 만들지 않습니다.
2. **Pipeline script from SCM**에서 Git 저장소, Branch Specifier `*/main`, Script Path `Jenkinsfile.deploy`를 설정합니다. 기본 `origin` remote와 기본 fetch refspec을 유지합니다.
3. SCM polling, webhook, 주기 실행 트리거는 끕니다. 배포 담당자만 작업을 변경하고 **Build Now**로 실행하도록 권한을 제한합니다.
4. `faretrack-deploy` 라벨의 전용 Linux 에이전트에 AWS IAM 역할을 연결합니다(예: EC2 instance profile). 기존 Terraform 리소스 관리 및 S3 state 접근 권한과 `.tflock` 객체 생성/삭제 권한을 부여합니다. GitHub OIDC 신뢰는 Jenkins용 인증으로 자동 전환되지 않으므로 Jenkins 에이전트 역할을 별도로 준비합니다.
5. 아래 **Secret text** 자격 증명을 배포 폴더에 등록합니다. CI에서 접근할 수 있는 전역 범위에 등록하지 않습니다.

| Jenkins credential ID | 기존 GitHub secret |
|---|---|
| `faretrack-google-client-id` | `GOOGLE_CLIENT_ID` |
| `faretrack-google-client-secret` | `GOOGLE_CLIENT_SECRET` |
| `faretrack-kakao-client-id` | `KAKAO_CLIENT_ID` |
| `faretrack-kakao-client-secret` | `KAKAO_CLIENT_SECRET` |
| `faretrack-ses-from-email` | `SES_FROM_EMAIL` |
| `faretrack-monitoring-alert-email` | `MONITORING_ALERT_EMAIL` |

배포는 테스트, Lambda 빌드 및 Terraform 검사 후 plan을 저장하고 그대로 apply합니다. 실행 전 코드 리뷰로 변경 내용을 확인합니다. 동시 실행은 대기시키며 S3 state 잠금도 유지합니다. 동일 환경의 배포 작업을 복제하지 않습니다. 비밀 값이 들어갈 수 있는 plan/state를 아티팩트로 보관하지 않고 작업 종료 시 workspace를 정리합니다.

### 자동 설정과 APK 생성

Jenkins 배포가 Terraform 적용, Secrets Manager 등록, Android 연결 설정 생성, debug APK 빌드를 순서대로 실행합니다. 빌드 화면의 **Artifacts**에서 `app-debug.apk`와 `deployment-info.json`을 다운로드합니다. JSON은 공개 API 주소, Cognito 앱 설정, 수동 등록할 콜백 URL만 포함합니다. APK는 개발 확인용이며 Play Store 배포 서명은 포함하지 않습니다. 기존 설치와 debug 서명 키가 다르면 업데이트 설치가 불가능할 수 있습니다.

배포 폴더 Credentials에 다음 세 항목을 추가합니다.

| ID | 종류 | 값 |
|---|---|---|
| `faretrack-serpapi-api-key` | Secret text | SerpAPI API 키 |
| `faretrack-firebase-service-account` | Secret file | Firebase Admin 서비스 계정 JSON |
| `faretrack-android-google-services` | Secret file | Android 앱 `com.faretrack.app`의 `google-services.json` |

Firebase 프로젝트 설정 → 서비스 계정에서 Admin 서비스 계정 파일을 발급하고, 같은 프로젝트의 Android 앱 설정에서 `google-services.json`을 다운로드합니다. 두 파일은 서로 다른 파일입니다. 프로젝트와 패키지 이름은 배포 전에 검사하며 파일 내용은 로그나 아티팩트로 출력하지 않습니다. AWS 배포 인증에는 두 secret에 대한 `secretsmanager:PutSecretValue` 권한이 필요합니다.

배포용 Linux 계정에 **Java 21 JDK**와 **Linux Android SDK Command-Line Tools**를 설치합니다. WSL에서 Windows SDK를 사용하지 않습니다. SDK 설치 후 필요한 패키지를 설치하고 라이선스를 검토·수락합니다.

```bash
export ANDROID_HOME="$HOME/Android/Sdk"
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" \
  "platform-tools" "platforms;android-36" "build-tools;34.0.0"
"$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager" --licenses
export JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64
export PATH="$JAVA_HOME/bin:$PATH"
```

위 환경을 설정한 터미널에서 배포 에이전트를 실행하거나 노드 환경 변수로 등록합니다. Java 21 경로로 agent.jar만 실행하는 것은 Gradle의 Java 환경 설정을 대신하지 않으므로 `JAVA_HOME`도 지정합니다. SDK 및 새 자격 증명이 없으면 AWS 적용 전에 중단합니다. 도구 설치는 [SDK Manager 공식 문서](https://developer.android.com/tools/sdkmanager)를 참고합니다.

Google/Kakao 콘솔의 콜백 URL 등록, SES 인증·SNS 구독 이메일 확인, 기기에 APK 설치는 직접 수행합니다. 콜백 URL은 `deployment-info.json`에 포함되며 URL 변경 시 다시 반영합니다. 가격 추적 스케줄은 기존 `dev.tfvars`의 `price_tracking_enabled = false`를 유지합니다.

### 전환 확인

Jenkins CI 성공 후 수동 배포의 AWS 계정/역할과 개발 환경 동작을 확인합니다. 정상 전환 후 사용하지 않는 GitHub environment secrets와 OIDC 신뢰를 정리합니다. 다른 작업에서 사용하는 역할은 유지합니다. 기존 CI/CD 아키텍처 이미지는 Actions 구성이므로 README에서 제외했습니다.

문법과 옵션은 [Jenkins Pipeline 공식 문서](https://www.jenkins.io/doc/book/pipeline/syntax/)를 참고합니다.
