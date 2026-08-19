# DynamoDB 데이터 모델

애플리케이션은 `Faretrack` 단일 테이블을 사용한다. 기본 키는 문자열 `PK`, `SK`이며 사용자별 알림 조회를 위한 `GSI1`이 있다.

| 모델 | PK | SK | 보조 키 |
|---|---|---|---|
| User | `USER#<userId>` | `PROFILE` | - |
| WatchTarget | `WATCH#<searchKey>` | `META` | - |
| UserAlert | `WATCH#<searchKey>` | `ALERT#<alertId>` | `GSI1PK=USER#<userId>`, `GSI1SK=ALERT#<createdAt>` |
| FlightSearch | `WATCH#<searchKey>` | `SEARCH#<requestedAt>#<id>` | - |
| PriceHistory | `WATCH#<searchKey>` | `PRICE#<checkedAt>#<priceId>` | - |
| NotificationHistory | `ALERT#<alertId>` | `NOTICE#<createdAt>#<notificationId>` | - |

## 관계와 조회 패턴

정규화된 `searchKey`가 WatchTarget의 식별자다. WatchTarget 저장은 조건부 Put을 사용해 동시에 같은 조건이 등록돼도 하나만 생성된다. 여러 UserAlert는 같은 `WATCH#<searchKey>` 파티션을 사용하므로 조건별 구독자와 가격 이력을 효율적으로 조회할 수 있다.

- 마이페이지: `GSI1PK=USER#<userId>` Query
- 조건별 알림: `PK=WATCH#<searchKey>`, `begins_with(SK, 'ALERT#')`
- 가격 이력: `PK=WATCH#<searchKey>`, `begins_with(SK, 'PRICE#')`
- 알림 이력: `PK=ALERT#<alertId>`, `begins_with(SK, 'NOTICE#')`

Repository의 Query와 Scan은 `LastEvaluatedKey` 페이지네이션을 처리한다. 현재 활성 WatchTarget 집계와 alertId 단건 탐색은 Scan을 사용하므로 데이터 규모가 커지면 상태별 GSI와 alertId GSI를 추가하는 것이 권장된다.

## 환경별 구현

`REPOSITORY_TYPE=memory`는 단위 테스트와 빠른 로컬 실행에 사용한다. `REPOSITORY_TYPE=dynamodb`는 동일 서비스 계층에 DynamoDB Repository를 주입한다. DynamoDB Local과 AWS DynamoDB는 endpoint 설정 유무만 다르고 같은 저장소 코드를 사용한다.
