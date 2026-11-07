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

SerpAPI/Firebase 자격 증명 등록은 기존처럼 로컬 `deploy-dev.sh`로 수행합니다. Jenkins 작업에는 Android 설정 갱신과 APK 빌드가 포함되지 않습니다. 인프라 재생성 시 로컬 스크립트로 자격 증명을 복구하고, Terraform 출력의 콜백 URL을 Google/Kakao 콘솔에 반영한 뒤 Android 설정 갱신과 APK 재빌드를 진행합니다.

### 전환 확인

Jenkins CI 성공 후 수동 배포의 AWS 계정/역할과 개발 환경 동작을 확인합니다. 정상 전환 후 사용하지 않는 GitHub environment secrets와 OIDC 신뢰를 정리합니다. 다른 작업에서 사용하는 역할은 유지합니다. 기존 CI/CD 아키텍처 이미지는 Actions 구성이므로 README에서 제외했습니다.

문법과 옵션은 [Jenkins Pipeline 공식 문서](https://www.jenkins.io/doc/book/pipeline/syntax/)를 참고합니다.
