# AWS 아키텍처 설계

## 구성과 역할

- Route 53 + ACM: 사용자 도메인과 TLS 인증서.
- CloudFront + WAF: 단일 공개 진입점, 정적 자산 캐시, 기본 공격 및 비정상 요청 차단.
- S3: 빌드된 프런트엔드 정적 자산. 퍼블릭 액세스 차단 후 OAC로 CloudFront만 허용.
- API Gateway HTTP API: REST 라우팅, 요청 제한, 인증 컨텍스트 전달.
- Cognito: 사용자 가입/인증과 JWT 발급. Lambda는 토큰의 subject만 신뢰한다.
- Application Lambda: 검색, 추적 설정, 마이페이지 API. DynamoDB, SQS, Secrets Manager에 최소 권한으로 접근.
- EventBridge Scheduler: 설정된 간격으로 스케줄 Lambda 실행. `PRICE_TRACKING_ENABLED`로 전체 추적 중단 가능.
- Scheduler Lambda: 활성 WatchTarget을 조회하고 조건 키별로 한 번만 SQS에 발행.
- Price Check SQS + Lambda: 동시성과 외부 API rate limit을 흡수. SerpApi를 호출하고 PriceHistory 저장 및 조건 비교.
- Notification SQS + Lambda + SES: 알림 처리를 가격 조회에서 분리하고 이메일 발송 이력을 저장.
- DynamoDB: User, WatchTarget, UserAlert, PriceHistory, NotificationHistory. 온디맨드 용량과 TTL 캐시 항목 사용.
- Secrets Manager: SerpApi key. 환경 변수에는 secret ARN/이름만 주입하며 값은 런타임 조회 및 캐시.
- CloudWatch: 로그, 지표, 예산/호출량/오류/지연/DLQ 알람.

## 데이터와 네트워크 흐름

브라우저는 HTTPS로 CloudFront에 접속합니다. 정적 요청은 OAC를 통해 S3로, `/api/*`는 API Gateway로 전달됩니다. Lambda와 DynamoDB/SQS/Secrets Manager는 AWS 서비스 엔드포인트를 사용합니다. SerpApi 호출이 필요한 Price Check Lambda만 HTTPS로 공개 API에 나갑니다. Lambda를 VPC에 넣어야 하는 별도 사유가 없다면 VPC 외부 실행으로 NAT Gateway 고정비를 피합니다. 조직 정책상 VPC가 필수라면 private subnet + NAT Gateway 또는 egress proxy를 사용합니다.

## 추적, 중복 제거, 장애 처리

정규화 키 `origin#destination#departure#return#tripType#passengers`가 WatchTarget의 유일 키입니다. 사용자 100명이 같은 조건을 구독해도 UserAlert 100개가 WatchTarget 1개를 참조하고 한 주기당 외부 호출은 1회입니다. 최근 결과는 TTL 캐시로 재사용하며 월 호출량 카운터가 한도에 도달하면 호출을 차단합니다.

SQS는 부분 배치 실패, 제한된 지수 백오프 재시도, visibility timeout을 사용합니다. 반복 실패 메시지는 DLQ로 이동하고 CloudWatch Alarm이 운영 채널로 알립니다. Notification 큐도 별도 DLQ를 사용해 조회 성공과 발송 실패를 분리합니다. idempotency key는 `watchKey#checkWindow`, 알림 이력 키는 `alertId#priceHistoryId#reason`으로 중복 처리를 막습니다.

## 보안과 비용

IAM 역할은 Lambda별 DynamoDB 테이블/인덱스와 큐 작업을 분리합니다. WAF rate rule, API Gateway throttling, Cognito JWT, 입력 검증, KMS 관리형 암호화, CloudTrail을 적용합니다. SerpApi key는 Secrets Manager에서만 관리하고 로그에서 마스킹합니다. 비용은 S3/CloudFront 정적 호스팅, Lambda arm64, DynamoDB on-demand, SQS batch, 캐시, 조건 중복 제거, 호출 월 한도, 추적 ON/OFF로 통제합니다. AWS Budgets와 호출량 알람을 함께 둡니다.
