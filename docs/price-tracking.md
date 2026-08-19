# 가격 추적 설계

## 조회와 중복 제거

검색 조건은 공항 코드를 대문자로 만들고 날짜의 하이픈을 제거한 뒤 `ICN#NRT#20261010#20261013#ROUND#1` 형태로 정규화한다. 이 키는 WatchTarget의 유일 키다. 같은 조건을 100명이 구독하면 UserAlert 100개가 하나의 WatchTarget을 참조하므로 스케줄 주기마다 Provider 호출은 한 번이다.

EventBridge가 Scheduler Lambda를 실행하면 활성 UserAlert가 참조하는 WatchTarget 키를 집합으로 만든 뒤 조건당 SQS 메시지 하나를 발행한다. Price Worker는 메시지의 idempotency key를 확인하고 가격 검색을 수행한다.

## 캐시와 SerpApi 한도 보호

사용자 검색에는 `CACHE_TTL_MINUTES` 동안 최근 결과를 재사용한다. 자동 가격 확인은 새 관측점을 만들기 위해 캐시를 우회하되, 한 스케줄 창에서는 WatchTarget당 한 번만 실행한다. 월 사용량은 `YYYY-MM` 버킷으로 집계하며 `SERPAPI_MONTHLY_REQUEST_LIMIT` 도달 시 외부 요청 전에 차단한다. 기본 테스트 모드는 고정된 모의 결과를 사용하므로 무료 한도를 소비하지 않는다.

429 또는 일시적 5xx에는 SQS 재시도 정책으로 제한된 지수 백오프를 적용한다. 반복 실패는 DLQ로 보내며 재시도 횟수를 무한히 늘리지 않는다. 전체 자동 추적은 `PRICE_TRACKING_ENABLED=false`로 즉시 정지할 수 있다.

## 가격 이력과 알림 판정

검색 결과 중 확인된 최저 금액을 PriceHistory에 시각, Provider와 함께 저장한다. 저장 후 각 UserAlert에 대해 다음을 독립적으로 평가한다.

- 현재 가격이 목표 가격 이하인지
- 현재 가격이 이전 PriceHistory의 최저가보다 낮은지
- 직전 관측값보다 설정 비율 이상 하락했는지

조건을 만족하면 `alertId#priceHistoryId#reason` 기반 중복 키를 가진 Notification Event를 생성한다. Notification Worker가 중복 발송을 막고 SES 발송 결과를 NotificationHistory에 기록한다. 화면과 알림은 인터넷 전체 최저가가 아닌 "현재 확인된 가격 중 최저가"로 표현한다.
