# REST API

| Method | Path | 설명 |
|---|---|---|
| POST | `/api/flights/search` | 조건 검색. TTL 캐시와 월 호출 한도 적용 |
| POST | `/api/alerts` | WatchTarget 재사용 후 사용자 알림 생성 |
| GET | `/api/alerts` | 사용자의 추적 목록과 가격 이력 조회 |
| PATCH | `/api/alerts/:id` | 목표가 또는 활성 상태 변경 |
| DELETE | `/api/alerts/:id` | 사용자 알림 삭제 |
| GET | `/api/history/:watchKey` | 조건별 가격 이력 조회 |
| POST | `/internal/price-check` | 스케줄러와 분리된 수동 가격 확인 |
| GET | `/api/health` | 실행 상태와 테스트/라이브 모드 확인 |

검색 본문은 `origin`, `destination`, `departureDate`, 선택적 `returnDate`, `tripType`(`ROUND`/`ONE_WAY`), `passengers`를 받습니다. 실제 AWS 배포에서 `/internal/*`는 IAM 인증 또는 별도 private integration으로 제한합니다.

## 항공편 검색 예시

```http
POST /api/flights/search
Content-Type: application/json

{
  "origin": "ICN",
  "destination": "NRT",
  "departureDate": "2026-10-10",
  "returnDate": "2026-10-13",
  "tripType": "ROUND",
  "passengers": 1
}
```

```json
{
  "key": "ICN#NRT#20261010#20261013#ROUND#1",
  "cached": false,
  "flights": [
    {
      "id": "flight_1234abcd",
      "airline": "대한항공",
      "flightNumber": "KE703",
      "departureTime": "09:55",
      "arrivalTime": "12:20",
      "stops": 0,
      "price": 164000,
      "seller": "Google Flights",
      "bookingUrl": "https://www.google.com/travel/flights"
    }
  ]
}
```

## 가격 알림 생성 예시

```http
POST /api/alerts
Content-Type: application/json

{
  "query": {
    "origin": "ICN",
    "destination": "NRT",
    "departureDate": "2026-10-10",
    "returnDate": "2026-10-13",
    "tripType": "ROUND",
    "passengers": 1
  },
  "targetPrice": 150000,
  "dropRatePercent": 10
}
```

응답은 재사용되거나 새로 생성된 `target`과 사용자별 `alert`를 반환합니다. 알림 목록의 각 항목에는 해당 WatchTarget과 PriceHistory 배열이 포함됩니다. `PATCH /api/alerts/:id`에는 `{ "active": false }` 또는 변경할 목표가를 전달합니다.

## 내부 가격 확인 예시

```http
POST /internal/price-check
```

```json
{
  "checkedTargets": 1,
  "notifications": 2,
  "disabled": false
}
```

오류 응답은 공통으로 `{ "error": "메시지" }` 형태다. 입력 오류와 외부 호출 한도 초과는 현재 MVP에서 HTTP 400으로 반환하며, 운영 배포에서는 오류 유형별 400, 429, 502 매핑을 권장한다.
