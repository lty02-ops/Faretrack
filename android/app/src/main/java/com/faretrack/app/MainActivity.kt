package com.faretrack.app

import android.Manifest
import android.app.Activity
import android.app.AlertDialog
import android.app.DatePickerDialog
import android.content.Intent
import android.graphics.Color
import android.graphics.drawable.GradientDrawable
import android.net.Uri
import android.os.Bundle
import android.os.Build
import android.text.InputType
import android.view.Gravity
import android.view.View
import android.widget.*
import org.json.JSONArray
import org.json.JSONObject
import java.text.NumberFormat
import java.time.LocalDate
import java.util.Locale
import java.util.concurrent.Executors
import com.google.firebase.messaging.FirebaseMessaging

class MainActivity : Activity() {
    private data class SearchSnapshot(val query: JSONObject, val response: JSONObject, val page: Int)

    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var auth: AuthManager
    private lateinit var api: ApiClient
    private lateinit var content: LinearLayout
    private var lastQuery: JSONObject? = null
    private var lastSearchResponse: JSONObject? = null
    private var lastResultsPage = 0
    private var showingFlightDetails = false
    private var detailRequestVersion = 0
    private val conditionSearchHistory = ArrayDeque<SearchSnapshot>()
    private val teal = Color.rgb(8, 127, 118)
    private val ink = Color.rgb(23, 33, 43)
    private val muted = Color.rgb(102, 113, 125)
    private val paper = Color.rgb(245, 246, 244)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        auth = AuthManager(this)
        api = ApiClient(this, auth)
        requestPushPermission()
        if (auth.isAuthorized) {
            registerPushToken()
            if (intent.getBooleanExtra(EXTRA_OPEN_WATCHES, false)) showWatches() else showSearch()
        } else showLogin()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        if (!auth.isAuthorized) showLogin()
        else if (intent.getBooleanExtra(EXTRA_OPEN_WATCHES, false)) showWatches()
    }

    @Deprecated("AppAuth uses the activity result returned by the browser")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != AuthManager.LOGIN_REQUEST_CODE) return
        auth.handleAuthorizationResult(data) { result ->
            runOnUiThread {
                result.onSuccess {
                    registerPushToken()
                    if (intent.getBooleanExtra(EXTRA_OPEN_WATCHES, false)) showWatches() else showSearch()
                }
                    .onFailure { toast(it.message ?: "Login failed.") }
            }
        }
    }

    override fun onDestroy() {
        executor.shutdownNow()
        auth.close()
        super.onDestroy()
    }

    @Deprecated("Handled explicitly for the single-activity screen stack")
    override fun onBackPressed() {
        if (showingFlightDetails && lastSearchResponse != null) returnToResults()
        else if (conditionSearchHistory.isNotEmpty()) returnToPreviousConditionSearch()
        else super.onBackPressed()
    }

    private fun requestPushPermission() {
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 4201)
        }
    }

    private fun registerPushToken() {
        FirebaseMessaging.getInstance().token.addOnSuccessListener { token ->
            executor.execute {
                runCatching { api.registerDevice(token) }
                    .onFailure { error -> runOnUiThread { toast("푸시 알림 기기 등록 실패: ${error.message}") } }
            }
        }.addOnFailureListener { error -> toast("Firebase 토큰 생성 실패: ${error.message}") }
    }

    private fun showLogin() {
        val root = column().apply {
            setPadding(dp(24), dp(48), dp(24), dp(24))
            setBackgroundColor(paper)
            gravity = Gravity.CENTER_VERTICAL
        }
        root.addView(label("Faretrack", 32, ink, true))
        root.addView(space(10))
        root.addView(label("Google 또는 Kakao로 로그인하세요.", 16, muted))
        root.addView(space(28))
        val googleLogin = socialLoginButton("G", "Google로 시작하기", Color.rgb(26, 115, 232), Color.WHITE, Color.rgb(210, 214, 220))
        googleLogin.setOnClickListener {
            startActivityForResult(auth.authorizationIntent("Google"), AuthManager.LOGIN_REQUEST_CODE)
        }
        root.addView(googleLogin, LinearLayout.LayoutParams(-1, dp(64)))
        root.addView(space(14))
        val kakaoLogin = socialLoginButton("●", "Kakao로 시작하기", Color.rgb(25, 25, 25), Color.rgb(254, 229, 0), Color.TRANSPARENT)
        kakaoLogin.setOnClickListener {
            startActivityForResult(auth.authorizationIntent("Kakao"), AuthManager.LOGIN_REQUEST_CODE)
        }
        root.addView(kakaoLogin, LinearLayout.LayoutParams(-1, dp(64)))

        if (BuildConfig.DEBUG) {
            root.addView(space(18))
            val developmentLogin = action("Continue in development mode", teal, Color.TRANSPARENT)
            developmentLogin.setOnClickListener {
                auth.loginForDevelopment()
                showSearch()
            }
            root.addView(developmentLogin, LinearLayout.LayoutParams(-1, dp(52)))
        }
        setContentView(root)
    }

    private fun shell() {
        showingFlightDetails = false
        val root = column().apply { setBackgroundColor(paper) }
        val header = row().apply {
            setPadding(dp(20), dp(14), dp(14), dp(12))
            setBackgroundColor(ink)
        }
        header.addView(label("F  Faretrack", 22, Color.WHITE, true), LinearLayout.LayoutParams(0, dp(48), 1f))
        header.addView(action("Logout", Color.WHITE, Color.TRANSPARENT).apply {
            setOnClickListener {
                val cognitoLogout = auth.logoutIntent()
                showLogin()
                startActivity(cognitoLogout)
            }
        })
        root.addView(header)

        content = column().apply { setPadding(dp(18), dp(24), dp(18), dp(100)) }
        root.addView(ScrollView(this).apply { addView(content) }, LinearLayout.LayoutParams(-1, 0, 1f))

        val navigation = row().apply {
            gravity = Gravity.CENTER
            setPadding(dp(10), dp(8), dp(10), dp(8))
            setBackgroundColor(Color.WHITE)
        }
        navigation.addView(action("항공권 검색", Color.WHITE, teal).apply { setOnClickListener { showSearch() } }, LinearLayout.LayoutParams(0, dp(52), 1f))
        navigation.addView(action("내 가격 추적", ink, Color.TRANSPARENT).apply { setOnClickListener { showWatches() } }, LinearLayout.LayoutParams(0, dp(52), 1f))
        root.addView(navigation)
        setContentView(root)
    }

    private fun showSearch() {
        conditionSearchHistory.clear()
        shell()
        content.addView(label("가격의 흐름을 보고,\n떠날 순간을 정하세요.", 30, ink, true))
        content.addView(space(10))
        content.addView(label("검색 조건을 저장하면 최근 확인 가격을 추적하고 원하는 순간에 알려드립니다.", 14, muted))
        content.addView(space(24))

        val origin = airportInput("출발 공항", "ICN")
        val destination = airportInput("도착 공항", "NRT")
        content.addView(field("출발지", origin))
        content.addView(field("도착지", destination))

        val departure = input("출발일", LocalDate.now().plusDays(45).toString()).apply { isFocusable = false }
        val returnDate = input("귀국일", LocalDate.now().plusDays(49).toString()).apply { isFocusable = false }
        departure.setOnClickListener { pickDate(departure) }
        returnDate.setOnClickListener { pickDate(returnDate) }
        content.addView(field("출발일", departure))
        content.addView(field("귀국일", returnDate))

        val trip = spinner(listOf("왕복", "편도"))
        val passengers = spinner(listOf("성인 1명", "성인 2명", "성인 3명", "성인 4명"))
        content.addView(field("여정", trip))
        content.addView(field("인원", passengers))

        val submit = action("현재 가격 검색", Color.WHITE, teal)
        submit.setOnClickListener {
            val originCode = airportCode(origin.text.toString())
            val destinationCode = airportCode(destination.text.toString())
            if (!isAirportCode(originCode) || !isAirportCode(destinationCode)) {
                toast("공항 코드는 ICN처럼 영문 3자로 입력하세요.")
                return@setOnClickListener
            }
            if (originCode == destinationCode) {
                toast("출발지와 도착지는 달라야 합니다.")
                return@setOnClickListener
            }
            if (LocalDate.parse(departure.text.toString()).isBefore(LocalDate.now())) {
                toast("출발일은 오늘 이후로 선택하세요.")
                return@setOnClickListener
            }
            if (trip.selectedItemPosition == 0 && LocalDate.parse(returnDate.text.toString()).isBefore(LocalDate.parse(departure.text.toString()))) {
                toast("귀국일은 출발일 이후로 선택하세요.")
                return@setOnClickListener
            }
            lastQuery = JSONObject()
                .put("origin", originCode)
                .put("destination", destinationCode)
                .put("departureDate", departure.text.toString())
                .put("returnDate", returnDate.text.toString())
                .put("tripType", if (trip.selectedItemPosition == 0) "ROUND" else "ONE_WAY")
                .put("passengers", passengers.selectedItemPosition + 1)
            runTask(submit, "검색 중...", { api.search(lastQuery!!) }, ::showResults)
        }
        content.addView(submit, LinearLayout.LayoutParams(-1, dp(58)))
    }

    private fun showResults(response: JSONObject) {
        lastSearchResponse = JSONObject(response.toString())
        showResultsPage(response, 0)
    }

    private fun showResultsPage(response: JSONObject, requestedPage: Int) {
        val query = lastQuery ?: return
        shell()
        val resultTitle = row().apply { gravity = Gravity.CENTER_VERTICAL }
        if (conditionSearchHistory.isNotEmpty()) {
            resultTitle.addView(action("‹", ink, Color.TRANSPARENT).apply {
                textSize = 34f
                contentDescription = "조건검색 이전 목록으로 돌아가기"
                setOnClickListener { returnToPreviousConditionSearch() }
            }, LinearLayout.LayoutParams(dp(52), dp(52)))
        }
        resultTitle.addView(label("${query.getString("origin")} → ${query.getString("destination")}", 28, ink, true), LinearLayout.LayoutParams(0, -2, 1f))
        content.addView(resultTitle)
        content.addView(label("현재 확인된 가격 · ${if (response.optBoolean("cached")) "캐시된 결과" else "방금 확인"}", 13, muted))
        content.addView(space(18))
        if (requestedPage == 0) renderMarketPriceInsights(response.optJSONObject("priceInsights"))
        if (requestedPage == 0) renderFilterControl()
        val flights = response.getJSONArray("flights")
        val pageCount = maxOf(1, (flights.length() + RESULT_PAGE_SIZE - 1) / RESULT_PAGE_SIZE)
        val page = requestedPage.coerceIn(0, pageCount - 1)
        lastSearchResponse = JSONObject(response.toString())
        lastResultsPage = page
        val start = page * RESULT_PAGE_SIZE
        val end = minOf(start + RESULT_PAGE_SIZE, flights.length())
        for (index in start until end) content.addView(flightCard(flights.getJSONObject(index)))

        if (pageCount > 1) {
            val pagination = row().apply { gravity = Gravity.CENTER_VERTICAL }
            val previous = action("이전", if (page > 0) teal else muted, Color.TRANSPARENT).apply {
                isEnabled = page > 0
                setOnClickListener { showResultsPage(response, page - 1) }
            }
            val pageLabel = label("${page + 1} / $pageCount", 14, ink, true).apply { gravity = Gravity.CENTER }
            val next = action("다음", if (page < pageCount - 1) teal else muted, Color.TRANSPARENT).apply {
                isEnabled = page < pageCount - 1
                setOnClickListener { showResultsPage(response, page + 1) }
            }
            pagination.addView(previous, LinearLayout.LayoutParams(0, dp(52), 1f))
            pagination.addView(pageLabel, LinearLayout.LayoutParams(0, dp(52), 1f))
            pagination.addView(next, LinearLayout.LayoutParams(0, dp(52), 1f))
            content.addView(pagination)
        }
        content.addView(label("표시된 금액은 마지막 확인 기준이며 판매 사이트에서 변경될 수 있습니다.", 12, muted))
    }

    private fun renderMarketPriceInsights(insights: JSONObject?) {
        val history = insights?.optJSONArray("history") ?: JSONArray()
        if (history.length() == 0) {
            content.addView(column().apply {
                setPadding(dp(16), dp(14), dp(16), dp(14))
                setBackgroundColor(Color.WHITE)
                addView(label("최근 30일 시장 가격 추세", 17, ink, true))
                addView(label("이 검색 조건은 비교할 과거 가격 데이터가 충분하지 않습니다.", 13, muted))
            }, LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, 0, 0, dp(14)) })
            return
        }
        val prices = (0 until history.length()).map { history.getJSONObject(it).getInt("price") }
        val low = prices.min()
        val high = prices.max()
        val average = prices.average().toInt()
        val current = insights?.optInt("lowestPrice", prices.last()) ?: prices.last()
        val difference = if (low > 0) ((current - low) * 100.0 / low) else 0.0
        val card = column().apply {
            setPadding(dp(16), dp(16), dp(16), dp(16))
            setBackgroundColor(Color.WHITE)
            addView(label("최근 30일 시장 가격 추세", 18, ink, true))
            addView(label("동일한 노선·일정 조건의 시장 최저가 기준", 12, muted))
            addView(PriceHistoryChart(this@MainActivity, history), LinearLayout.LayoutParams(-1, dp(190)).apply { setMargins(0, dp(8), 0, dp(4)) })
            addView(label("30일 최저 ${won(low)}   ·   평균 ${won(average)}", 14, ink, true))
            addView(label("30일 최고 ${won(high)}", 13, muted))
            addView(label(
                if (difference <= 0.0) "현재 가격은 최근 30일 최저 수준입니다."
                else "현재 가격은 최근 30일 최저가보다 ${String.format(Locale.KOREA, "%.1f", difference)}% 높습니다.",
                13, if (difference <= 5.0) teal else muted, true
            ))
        }
        content.addView(card, LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, 0, 0, dp(14)) })
    }

    private fun renderFilterControl() {
        val query = lastQuery ?: return
        val button = action("조건검색", Color.WHITE, ink).apply { setOnClickListener { showFilterDialog() } }
        content.addView(button, LinearLayout.LayoutParams(-1, dp(54)).apply { setMargins(0, 0, 0, dp(6)) })
        val summaries = buildList {
            timeFilterLabel(query.optString("outboundTimes"))?.let { add("가는 편 $it") }
            timeFilterLabel(query.optString("returnTimes"))?.let { add("오는 편 $it") }
            when (query.optString("stops")) { "1" -> add("직항만"); "2" -> add("경유 1회 이하"); "3" -> add("경유 2회 이하") }
            if (query.optInt("maxPrice") > 0) add("${won(query.optInt("maxPrice"))} 이하")
        }
        if (summaries.isNotEmpty()) {
            content.addView(label(summaries.joinToString(" · "), 13, teal, true), LinearLayout.LayoutParams(-1, -2).apply { setMargins(dp(2), 0, 0, dp(12)) })
        } else content.addView(space(8))
    }

    private fun showFilterDialog() {
        val query = lastQuery ?: return
        val outbound = spinner(TIME_FILTER_LABELS).apply { setSelection(TIME_FILTER_VALUES.indexOf(query.optString("outboundTimes")).coerceAtLeast(0)) }
        val inbound = spinner(TIME_FILTER_LABELS).apply {
            setSelection(TIME_FILTER_VALUES.indexOf(query.optString("returnTimes")).coerceAtLeast(0))
            isEnabled = query.optString("tripType") == "ROUND"
        }
        val stopValues = listOf("", "1", "2", "3")
        val stops = spinner(listOf("전체 경유 조건", "직항만", "경유 1회 이하", "경유 2회 이하")).apply {
            setSelection(stopValues.indexOf(query.optString("stops")).coerceAtLeast(0))
        }
        val maxPrice = input("예: 500000", query.optInt("maxPrice").takeIf { it > 0 }?.toString().orEmpty()).apply {
            inputType = InputType.TYPE_CLASS_NUMBER
        }
        val panel = column().apply {
            setPadding(dp(18), dp(8), dp(18), 0)
            addView(field("가는 편 출발 시간", outbound))
            addView(field("오는 편 출발 시간", inbound))
            addView(field("경유", stops))
            addView(field("최대 가격 (원)", maxPrice))
        }
        val scroll = ScrollView(this).apply { addView(panel) }
        val dialog = AlertDialog.Builder(this)
            .setTitle("항공편 조건검색")
            .setView(scroll)
            .setNegativeButton("취소", null)
            .setNeutralButton("초기화") { _, _ -> applyFilters("", "", "", 0) }
            .setPositiveButton("적용") { _, _ ->
                applyFilters(
                    TIME_FILTER_VALUES[outbound.selectedItemPosition],
                    if (inbound.isEnabled) TIME_FILTER_VALUES[inbound.selectedItemPosition] else "",
                    stopValues[stops.selectedItemPosition],
                    maxPrice.text.toString().toIntOrNull() ?: 0
                )
            }
            .create()
        dialog.show()
    }

    private fun applyFilters(outboundTimes: String, returnTimes: String, stops: String, maxPrice: Int) {
        val previousQuery = lastQuery ?: return
        val previousResponse = lastSearchResponse
        val previousPage = lastResultsPage
        val query = JSONObject(previousQuery.toString())
        fun setOrRemove(name: String, value: String) { if (value.isBlank()) query.remove(name) else query.put(name, value) }
        setOrRemove("outboundTimes", outboundTimes)
        setOrRemove("returnTimes", returnTimes)
        setOrRemove("stops", stops)
        if (maxPrice > 0) query.put("maxPrice", maxPrice) else query.remove("maxPrice")
        shell()
        content.addView(label("조건 적용 중", 26, ink, true))
        content.addView(ProgressBar(this).apply { isIndeterminate = true }, LinearLayout.LayoutParams(-1, dp(72)))
        executor.execute {
            runCatching { api.search(query) }
                .onSuccess { response -> runOnUiThread {
                    if (previousResponse != null) {
                        conditionSearchHistory.addLast(SearchSnapshot(
                            JSONObject(previousQuery.toString()), JSONObject(previousResponse.toString()), previousPage
                        ))
                    }
                    lastQuery = query
                    showResults(response)
                } }
                .onFailure { error -> runOnUiThread {
                    lastQuery = previousQuery
                    toast("조건검색 실패: ${error.message}")
                    if (previousResponse != null) showResultsPage(previousResponse, previousPage) else showSearch()
                } }
        }
    }

    private fun timeFilterLabel(value: String): String? {
        val index = TIME_FILTER_VALUES.indexOf(value)
        return if (index > 0) TIME_FILTER_LABELS[index] else null
    }

    private fun flightCard(flight: JSONObject): View {
        val card = column().apply {
            setPadding(dp(18), dp(18), dp(14), dp(18))
            setBackgroundColor(Color.WHITE)
            isClickable = true
            isFocusable = true
        }
        val airlineHeader = row().apply { gravity = Gravity.CENTER_VERTICAL }
        airlineLogoResource(flight.getString("flightNumber"))?.let { logoResource ->
            airlineHeader.addView(ImageView(this).apply {
                setImageResource(logoResource)
                scaleType = ImageView.ScaleType.FIT_CENTER
                contentDescription = "${localizedAirline(flight.getString("airline"))} 로고"
            }, LinearLayout.LayoutParams(dp(34), dp(34)).apply { setMargins(0, 0, dp(10), 0) })
        }
        airlineHeader.addView(
            label("${localizedAirline(flight.getString("airline"))}  ${flight.getString("flightNumber")}", 18, ink, true),
            LinearLayout.LayoutParams(0, -2, 1f)
        )
        airlineHeader.addView(label("›", 32, teal, true).apply { gravity = Gravity.CENTER }, LinearLayout.LayoutParams(dp(34), dp(40)))
        card.addView(airlineHeader)
        val stops = if (flight.getInt("stops") == 0) "직항" else "경유 ${flight.getInt("stops")}회"
        card.addView(label("${flight.getString("departureTime")}  →  ${flight.getString("arrivalTime")}   ·   $stops", 14, muted))
        card.addView(space(14))
        card.addView(label(won(flight.getInt("price")), 26, ink, true))
        card.addView(label("항공편 상세 보기", 13, teal, true).apply { gravity = Gravity.END })
        card.setOnClickListener { openFlightDetails(flight) }
        card.layoutParams = LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, 0, 0, dp(12)) }
        return card
    }

    private fun openFlightDetails(outbound: JSONObject) {
        val query = lastQuery ?: return
        val departureToken = outbound.optString("departureToken")
        val requestVersion = ++detailRequestVersion
        if (query.optString("tripType") != "ROUND" || departureToken.isBlank()) {
            showFlightDetails(outbound, null)
            return
        }
        showFlightDetails(outbound, null, true)
        executor.execute {
            runCatching { api.returnOptions(departureToken, query) }
                .onSuccess { response -> runOnUiThread {
                    if (!showingFlightDetails || requestVersion != detailRequestVersion) return@runOnUiThread
                    val returns = response.optJSONArray("flights") ?: JSONArray()
                    if (returns.length() == 0) {
                        toast("선택한 항공편의 오는 편을 찾지 못했습니다.")
                        showFlightDetails(outbound, null)
                    } else showFlightDetails(outbound, returns.getJSONObject(0))
                } }
                .onFailure { error -> runOnUiThread {
                    if (!showingFlightDetails || requestVersion != detailRequestVersion) return@runOnUiThread
                    toast("오는 편 조회 실패: ${error.message}")
                    showFlightDetails(outbound, null)
                } }
        }
    }

    private fun showFlightDetails(outbound: JSONObject, inbound: JSONObject?, loadingReturn: Boolean = false) {
        val query = lastQuery ?: return
        shell()
        showingFlightDetails = true
        val title = row().apply { gravity = Gravity.CENTER_VERTICAL }
        title.addView(action("‹", ink, Color.TRANSPARENT).apply {
            textSize = 34f
            contentDescription = "항공권 조회 목록으로 돌아가기"
            setOnClickListener { returnToResults() }
        }, LinearLayout.LayoutParams(dp(52), dp(52)))
        title.addView(label("항공편 상세", 30, ink, true), LinearLayout.LayoutParams(0, -2, 1f))
        content.addView(title)
        content.addView(label("${query.getString("origin")} → ${query.getString("destination")}", 15, muted))
        content.addView(space(16))
        content.addView(itineraryLeg("가는 편", query.getString("origin"), query.getString("destination"), outbound))
        if (query.optString("tripType") == "ROUND") {
            content.addView(space(10))
            if (inbound != null) content.addView(itineraryLeg("오는 편", query.getString("destination"), query.getString("origin"), inbound))
            else if (loadingReturn) content.addView(row().apply {
                gravity = Gravity.CENTER_VERTICAL
                addView(ProgressBar(this@MainActivity).apply { isIndeterminate = true }, LinearLayout.LayoutParams(dp(42), dp(42)))
                addView(label("오는 편을 확인하고 있습니다.", 14, muted), LinearLayout.LayoutParams(0, -2, 1f))
            })
            else content.addView(label("오는 편 정보가 제공되지 않는 조합입니다.", 14, muted))
        }
        if (loadingReturn) return
        content.addView(space(18))
        val selected = inbound?.let {
            JSONObject(it.toString()).apply {
                if (optInt("price") <= 0) put("price", outbound.getInt("price"))
                if (optString("departureToken").isBlank() && outbound.optString("departureToken").isNotBlank()) {
                    put("departureToken", outbound.optString("departureToken"))
                }
                if (optString("bookingToken").isBlank() && outbound.optString("bookingToken").isNotBlank()) {
                    put("bookingToken", outbound.optString("bookingToken"))
                }
            }
        } ?: outbound
        content.addView(label(if (inbound == null) "총액" else "왕복 총액", 13, muted, true))
        content.addView(label(won(selected.getInt("price")), 32, teal, true))
        content.addView(space(14))
        val buttons = row()
        buttons.addView(action("가격 추적", Color.WHITE, teal).apply {
            setOnClickListener { showTracking(selected) }
        }, LinearLayout.LayoutParams(0, dp(58), 1f))
        val booking = action("판매처 이동", Color.WHITE, ink)
        booking.setOnClickListener {
            val token = selected.optString("bookingToken")
            val departureToken = selected.optString("departureToken")
            val selectedFlights = selectedFlightPayload(outbound, inbound)
            if (token.isBlank() && departureToken.isBlank() && selectedFlights == null) toast("이 항공권의 판매처 정보를 제공하지 않습니다.")
            else runTask(booking, "판매처 확인 중", { api.bookingOptions(token, departureToken, selectedFlights, query) }, ::showBookingOptions)
        }
        buttons.addView(booking, LinearLayout.LayoutParams(0, dp(58), 1f))
        content.addView(buttons)
    }

    private fun selectedFlightPayload(outbound: JSONObject, inbound: JSONObject?): JSONObject? {
        val outboundSegments = outbound.optJSONArray("segments") ?: return null
        if (outboundSegments.length() == 0) return null
        val payload = JSONObject().put("outbound", outboundSegments)
        if (inbound != null) {
            val returnSegments = inbound.optJSONArray("segments") ?: return null
            if (returnSegments.length() == 0) return null
            payload.put("return", returnSegments)
        }
        return payload
    }

    private fun returnToResults() {
        detailRequestVersion++
        showingFlightDetails = false
        val response = lastSearchResponse
        if (response != null) showResultsPage(response, lastResultsPage) else showSearch()
    }

    private fun returnToPreviousConditionSearch() {
        if (conditionSearchHistory.isEmpty()) return
        val previous = conditionSearchHistory.removeLast()
        lastQuery = JSONObject(previous.query.toString())
        lastSearchResponse = JSONObject(previous.response.toString())
        lastResultsPage = previous.page
        showResultsPage(lastSearchResponse!!, previous.page)
    }

    private fun itineraryLeg(title: String, origin: String, destination: String, flight: JSONObject): View {
        val block = column().apply { setPadding(dp(18), dp(16), dp(18), dp(18)); setBackgroundColor(Color.WHITE) }
        block.addView(label(title, 14, teal, true))
        block.addView(space(6))
        block.addView(label("$origin  →  $destination", 21, ink, true))
        block.addView(label("${localizedAirline(flight.getString("airline"))}  ${flight.getString("flightNumber")}", 16, ink, true))
        block.addView(space(10))
        block.addView(label("${flight.getString("departureTime")}  →  ${flight.getString("arrivalTime")}", 17, ink, true))
        val stops = if (flight.optInt("stops") == 0) "직항" else "경유 ${flight.optInt("stops")}회"
        block.addView(label(stops, 13, muted))
        return block
    }

    private fun showBookingOptions(response: JSONObject) {
        val options = response.optJSONArray("options") ?: JSONArray()
        if (options.length() == 0) {
            toast("이 항공권의 예약 가능한 판매처를 찾지 못했습니다.")
            return
        }
        val labels = Array(options.length()) { index ->
            val option = options.getJSONObject(index)
            val price = option.optInt("price")
            "${option.optString("seller")} · ${option.optString("segment")}" + if (price > 0) " · ${won(price)}" else ""
        }
        AlertDialog.Builder(this)
            .setTitle("판매처 선택")
            .setItems(labels) { _, index -> openBookingOption(options.getJSONObject(index)) }
            .setNegativeButton("취소", null)
            .show()
    }

    private fun openBookingOption(option: JSONObject) {
        val url = option.optString("url")
        if (!url.startsWith("https://")) {
            toast("이 판매처의 이동 링크를 사용할 수 없습니다.")
            return
        }
        val postData = option.optString("postData")
        if (postData.isBlank()) startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
        else startActivity(Intent(this, BookingActivity::class.java)
            .putExtra(BookingActivity.EXTRA_URL, url)
            .putExtra(BookingActivity.EXTRA_POST_DATA, postData))
    }

    private fun showTracking(flight: JSONObject) {
        val query = lastQuery ?: return
        shell()
        content.addView(label("${query.getString("origin")} → ${query.getString("destination")}", 28, ink, true))
        content.addView(label("현재 확인된 가격", 13, muted))
        content.addView(label(won(flight.getInt("price")), 30, teal, true))
        content.addView(space(20))
        val target = input("목표 가격", "150000").apply { inputType = InputType.TYPE_CLASS_NUMBER }
        val drop = spinner(listOf("추가 5% 하락", "추가 10% 하락", "추가 15% 하락")).apply { setSelection(1) }
        content.addView(field("목표 가격 (원)", target))
        content.addView(field("목표 도달 후 추가 하락 기준", drop))
        val create = action("가격 알림 등록", Color.WHITE, teal)
        create.setOnClickListener {
            val payload = JSONObject().put("query", query).put("targetPrice", target.text.toString().toInt()).put("baselinePrice", flight.getInt("price")).put("dropRatePercent", listOf(5, 10, 15)[drop.selectedItemPosition])
            runTask(create, "등록 중...", { api.createAlert(payload) }) { toast("가격 알림을 등록했습니다."); showWatches() }
        }
        content.addView(create, LinearLayout.LayoutParams(-1, dp(58)))
    }

    private fun showWatches() {
        shell()
        content.addView(label("내 가격 추적", 30, ink, true))
        val refresh = action("지금 가격 확인", Color.WHITE, teal)
        refresh.setOnClickListener { runTask(refresh, "확인 중...", api::runPriceCheck) { toast("${it.optInt("checkedTargets")}개 조건을 확인했습니다."); showWatches() } }
        content.addView(refresh, LinearLayout.LayoutParams(-1, dp(54)))
        content.addView(space(18))
        runTask(null, "", api::getAlerts, ::renderWatches)
    }

    private fun renderWatches(items: JSONArray) {
        if (items.length() == 0) { content.addView(label("아직 추적 중인 여정이 없습니다.", 16, muted, true)); return }
        for (index in 0 until items.length()) {
            val item = items.getJSONObject(index)
            val query = item.getJSONObject("target").getJSONObject("query")
            val history = item.getJSONArray("history")
            val current = if (history.length() > 0) won(history.getJSONObject(history.length() - 1).getInt("price")) else "확인 전"
            val id = item.getString("id")
            val card = column().apply { setPadding(dp(16), dp(16), dp(16), dp(16)); setBackgroundColor(Color.WHITE) }
            val titleRow = row().apply { gravity = Gravity.CENTER_VERTICAL }
            titleRow.addView(
                label("${query.getString("origin")} → ${query.getString("destination")}", 20, ink, true),
                LinearLayout.LayoutParams(0, dp(44), 1f)
            )
            titleRow.addView(action("×", Color.rgb(190, 55, 45), Color.TRANSPARENT).apply {
                contentDescription = "가격 추적 삭제"
                textSize = 28f
                minWidth = 0
                minHeight = 0
                setPadding(0, 0, 0, 0)
                setOnClickListener { confirmDelete(id) }
            }, LinearLayout.LayoutParams(dp(48), dp(48)))
            card.addView(titleRow)
            card.addView(label("${query.getString("departureDate")} · 목표 ${won(item.getInt("targetPrice"))}", 13, muted))
            card.addView(label("최근 조회 가격  $current", 16, teal, true))
            card.addView(
                PriceHistoryChart(this, history, item.getInt("targetPrice")),
                LinearLayout.LayoutParams(-1, dp(190)).apply { setMargins(0, dp(8), 0, dp(8)) }
            )
            content.addView(card, LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, 0, 0, dp(12)) })
        }
    }

    private fun confirmDelete(id: String) {
        AlertDialog.Builder(this)
            .setTitle("가격 추적 삭제")
            .setMessage("이 가격 추적과 저장된 가격 이력을 지우시겠습니까?")
            .setNegativeButton("취소", null)
            .setPositiveButton("삭제") { _, _ ->
                runTask(null, "", { api.deleteAlert(id); Unit }) {
                    toast("가격 추적을 삭제했습니다.")
                    showWatches()
                }
            }
            .show()
    }

    private fun <T> runTask(button: Button?, busy: String, task: () -> T, success: (T) -> Unit) {
        val original = button?.text
        button?.apply { isEnabled = false; text = busy }
        executor.execute {
            runCatching(task).onSuccess { value -> runOnUiThread { button?.apply { isEnabled = true; text = original }; success(value) } }
                .onFailure { error -> runOnUiThread { button?.apply { isEnabled = true; text = original }; toast("${error.message}\nAPI: ${api.baseUrl}") } }
        }
    }

    private fun column() = LinearLayout(this).apply { orientation = LinearLayout.VERTICAL }
    private fun row() = column().apply { orientation = LinearLayout.HORIZONTAL }
    private fun label(value: String, size: Int, color: Int, bold: Boolean = false) = TextView(this).apply { text = value; textSize = size.toFloat(); setTextColor(color); setLineSpacing(0f, 1.15f); if (bold) setTypeface(null, 1) }
    private fun input(hintText: String, value: String) = EditText(this).apply { hint = hintText; setText(value); setTextColor(ink); isSingleLine = true; setPadding(0, dp(9), 0, dp(9)) }
    private fun airportInput(hintText: String, code: String) = AutoCompleteTextView(this).apply {
        hint = hintText
        setText(AIRPORTS.firstOrNull { it.endsWith("($code)") } ?: code, false)
        setTextColor(ink)
        isSingleLine = true
        threshold = 0
        setPadding(0, dp(9), 0, dp(9))
        setAdapter(ArrayAdapter(this@MainActivity, android.R.layout.simple_dropdown_item_1line, AIRPORTS))
        setOnClickListener { showDropDown() }
        setOnFocusChangeListener { _, focused -> if (focused) showDropDown() }
    }
    private fun spinner(values: List<String>) = Spinner(this).apply { adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, values) }
    private fun field(title: String, input: View) = column().apply { setPadding(dp(14), dp(10), dp(14), dp(10)); setBackgroundColor(Color.WHITE); addView(label(title, 12, muted, true)); addView(input, LinearLayout.LayoutParams(-1, dp(52))); layoutParams = LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, 0, 0, dp(10)) } }
    private fun action(value: String, color: Int, background: Int) = Button(this).apply { text = value; setTextColor(color); setBackgroundColor(background); isAllCaps = false }
    private fun socialLoginButton(icon: String, title: String, foreground: Int, backgroundColor: Int, strokeColor: Int) = row().apply {
        gravity = Gravity.CENTER_VERTICAL
        isClickable = true
        isFocusable = true
        contentDescription = title
        background = GradientDrawable().apply {
            shape = GradientDrawable.RECTANGLE
            cornerRadius = dp(6).toFloat()
            setColor(backgroundColor)
            if (strokeColor != Color.TRANSPARENT) setStroke(dp(1), strokeColor)
        }
        setPadding(dp(22), 0, dp(22), 0)
        addView(label(icon, 22, foreground, true).apply { gravity = Gravity.CENTER }, LinearLayout.LayoutParams(dp(44), -1))
        addView(label(title, 18, Color.rgb(20, 24, 28), true).apply { gravity = Gravity.CENTER }, LinearLayout.LayoutParams(0, -1, 1f))
        addView(Space(this@MainActivity), LinearLayout.LayoutParams(dp(44), 1))
    }
    private fun sellerLogo(seller: String) = TextView(this).apply {
        val (wordmark, foreground, background) = when (seller.lowercase()) {
            "trip.com" -> Triple("Trip.com", Color.WHITE, Color.rgb(40, 112, 220))
            "kiwi.com" -> Triple("kiwi.com", Color.rgb(0, 82, 73), Color.rgb(220, 245, 239))
            "판매처 확인" -> Triple("판매처 확인", muted, Color.rgb(238, 240, 241))
            else -> Triple("Google Flights", Color.rgb(26, 115, 232), Color.rgb(239, 243, 250))
        }
        text = wordmark
        textSize = 13f
        gravity = Gravity.CENTER
        setTypeface(null, 1)
        setTextColor(foreground)
        setBackgroundColor(background)
        setPadding(dp(12), 0, dp(12), 0)
    }
    private fun space(height: Int) = Space(this).apply { layoutParams = LinearLayout.LayoutParams(1, dp(height)) }
    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
    private fun toast(message: String) = Toast.makeText(this, message, Toast.LENGTH_LONG).show()
    private fun won(value: Int) = NumberFormat.getNumberInstance(Locale.KOREA).format(value) + "원"
    private fun isAirportCode(value: String) = value.length == 3 && value.all { it in 'A'..'Z' }
    private fun airportCode(value: String): String {
        val normalized = value.trim().uppercase()
        return Regex("\\(([A-Z]{3})\\)\\s*$").find(normalized)?.groupValues?.get(1) ?: normalized
    }
    private fun localizedAirline(value: String): String {
        val normalized = value.trim().lowercase()
        return when (normalized) {
            "korean air", "korean airlines" -> "대한항공"
            "asiana airlines", "asiana" -> "아시아나항공"
            "jeju air" -> "제주항공"
            "jin air" -> "진에어"
            "t'way air", "tway air", "t-way air" -> "티웨이항공"
            "air busan" -> "에어부산"
            "air seoul" -> "에어서울"
            "eastar jet" -> "이스타항공"
            "aero k", "aero k airlines" -> "에어로케이"
            "japan airlines", "jal" -> "일본항공"
            "all nippon airways", "ana" -> "전일본공수"
            "peach aviation", "peach" -> "피치항공"
            "zipair", "zipair tokyo" -> "집에어"
            else -> value
        }
    }
    private fun airlineLogoResource(flightNumber: String): Int? {
        val normalized = flightNumber.trim().uppercase()
        return when {
            normalized.startsWith("KE") -> R.drawable.airline_ke
            normalized.startsWith("OZ") -> R.drawable.airline_oz
            normalized.startsWith("7C") -> R.drawable.airline_7c
            normalized.startsWith("LJ") -> R.drawable.airline_lj
            else -> null
        }
    }

    companion object {
        const val EXTRA_OPEN_WATCHES = "com.faretrack.app.OPEN_WATCHES"
        private const val RESULT_PAGE_SIZE = 5
        private val AIRPORTS = AirportCatalog.airports
        private val TIME_FILTER_LABELS = listOf(
            "전체 시간", "00:00~03:00", "03:00~06:00", "06:00~09:00", "09:00~12:00",
            "12:00~15:00", "15:00~18:00", "18:00~21:00", "21:00~24:00"
        )
        private val TIME_FILTER_VALUES = listOf("", "0,2", "3,5", "6,8", "9,11", "12,14", "15,17", "18,20", "21,23")
    }
    private fun pickDate(field: EditText) { val initial = LocalDate.parse(field.text); DatePickerDialog(this, { _, y, m, d -> field.setText(LocalDate.of(y, m + 1, d).toString()) }, initial.year, initial.monthValue - 1, initial.dayOfMonth).show() }
}
