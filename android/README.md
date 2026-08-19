# Faretrack Android

기존 Faretrack REST API를 사용하는 Kotlin 네이티브 Android 앱이다. Kotlin/JVM 17과 Android SDK를 사용하며 검색, 검색 결과, 외부 판매처 이동, 가격 알림 등록, 추적 목록, 활성화/일시정지/삭제, 수동 가격 확인을 제공한다.

에뮬레이터의 기본 API 주소는 `http://10.0.2.2:3000`이다. 먼저 프로젝트 루트에서 `npm.cmd start`로 백엔드를 실행한다. 실제 기기에서는 앱의 **API 설정**에서 개발 PC의 같은 네트워크 IP 또는 배포된 HTTPS API 주소를 입력한다.

Android Studio에서 `android/`를 프로젝트로 열어 실행한다. Debug APK는 `app/build/outputs/apk/debug/app-debug.apk`에 생성된다.
