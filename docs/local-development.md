# 로컬 개발

## Docker Compose 실행

Docker Desktop을 실행한 뒤 프로젝트 루트에서 다음 명령을 사용한다.

```powershell
docker compose up -d --build
```

Compose는 DynamoDB Local을 시작하고 `dynamodb-init` 서비스로 `Faretrack` 테이블과 `GSI1`을 생성한 다음 백엔드와 프런트엔드를 시작한다.

- 프런트엔드: `http://localhost:8081`
- 백엔드 API: `http://localhost:3000`
- DynamoDB Local: `http://localhost:8000`
- Android 에뮬레이터 API: `http://10.0.2.2:3000`

데이터는 `dynamodb-data` named volume에 저장되므로 컨테이너를 재시작하거나 `docker compose down`을 실행해도 유지된다. 데이터를 포함해 완전히 초기화할 때만 명시적으로 `docker compose down -v`를 사용한다.

## Node.js 직접 실행

```powershell
npm.cmd install
npm.cmd start
npm.cmd test
```

직접 실행의 기본 저장소는 메모리다. 로컬 DynamoDB를 사용하려면 다음 환경변수를 지정한다.

```env
REPOSITORY_TYPE=dynamodb
AWS_REGION=ap-northeast-2
AWS_ACCESS_KEY_ID=local
AWS_SECRET_ACCESS_KEY=local
DYNAMODB_ENDPOINT=http://localhost:8000
DYNAMODB_TABLE_NAME=Faretrack
```

테이블 초기화는 `npm.cmd run dynamodb:init`으로 실행한다. 실제 AWS에서는 `DYNAMODB_ENDPOINT`와 로컬 자격 증명을 제거하고 Lambda 또는 컨테이너의 IAM 역할을 사용한다.

SerpApi 실연동 시에만 `TEST_MODE=false`와 `SERPAPI_API_KEY`를 설정한다. `PRICE_TRACKING_ENABLED=false`는 가격 추적 실행을 중단한다.
