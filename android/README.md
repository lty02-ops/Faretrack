# Faretrack Android

기존 Faretrack REST API를 사용하는 Kotlin 네이티브 Android 앱이다. Kotlin/JVM 17과 Android SDK를 사용하며 검색, 검색 결과, 외부 판매처 이동, 가격 알림 등록, 추적 목록, 활성화/일시정지/삭제, 수동 가격 확인을 제공한다.

AWS 배포 환경을 사용할 때는 로컬 백엔드를 실행할 필요가 없다. `faretrack.local.properties`에 배포된 HTTPS API 주소와 Cognito client ID, 도메인을 설정한 뒤 빌드한다. 파일 이름의 `local`은 PC에 보관하는 빌드 설정이라는 뜻이다. 자세한 설정 및 설치 절차는 [루트 README](../README.md)를 참고한다. 기존 앱에서 API 주소를 수동 변경했다면 앱의 **API 설정**도 배포된 HTTPS 주소로 맞춘다.

Android Studio에서 `android/`를 프로젝트로 열어 실행한다. Debug APK는 `app/build/outputs/apk/debug/app-debug.apk`에 생성된다.
