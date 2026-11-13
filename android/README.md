# Faretrack Android

Faretrack API를 사용하는 Kotlin Android 앱입니다. 항공편 검색, 판매처 이동, 가격 알림 등록과 추적 관리, 수동 가격 확인 기능이 있습니다. Kotlin/JVM 17과 Android SDK를 사용합니다.

`faretrack.local.properties`에 배포된 HTTPS API 주소와 Cognito client ID, 도메인을 설정한 뒤 빌드합니다. 설정 및 설치 절차는 [루트 README](../README.md)를 참고합니다. 앱에서 API 주소를 변경한 적이 있다면 **API 설정**에도 같은 주소를 입력합니다.

Android Studio에서 `android/`를 프로젝트로 열어 실행합니다. Debug APK 경로는 `app/build/outputs/apk/debug/app-debug.apk`입니다.
