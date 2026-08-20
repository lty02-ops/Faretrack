package com.faretrack.app

import android.app.Activity
import android.app.AlertDialog
import android.app.DatePickerDialog
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
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

class MainActivity : Activity() {
    private val executor = Executors.newSingleThreadExecutor()
    private lateinit var auth: AuthManager
    private lateinit var api: ApiClient
    private lateinit var content: LinearLayout
    private var lastQuery: JSONObject? = null
    private val teal = Color.rgb(8, 127, 118)
    private val ink = Color.rgb(23, 33, 43)
    private val muted = Color.rgb(102, 113, 125)
    private val paper = Color.rgb(245, 246, 244)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        auth = AuthManager(this)
        api = ApiClient(this, auth)
        if (auth.isAuthorized) showSearch() else showLogin()
    }

    @Deprecated("AppAuth uses the activity result returned by the browser")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != AuthManager.LOGIN_REQUEST_CODE) return
        auth.handleAuthorizationResult(data) { result ->
            runOnUiThread {
                result.onSuccess { showSearch() }
                    .onFailure { toast(it.message ?: "Login failed.") }
            }
        }
    }

    override fun onDestroy() {
        executor.shutdownNow()
        auth.close()
        super.onDestroy()
    }

    private fun showLogin() {
        val root = column().apply {
            setPadding(dp(24), dp(48), dp(24), dp(24))
            setBackgroundColor(paper)
            gravity = Gravity.CENTER_VERTICAL
        }
        root.addView(label("Faretrack", 32, ink, true))
        root.addView(space(10))
        root.addView(label("Sign in with Google or Kakao to track flight prices.", 16, muted))
        root.addView(space(28))
        val login = action("Sign in", Color.WHITE, teal)
        login.setOnClickListener {
            startActivityForResult(auth.authorizationIntent(), AuthManager.LOGIN_REQUEST_CODE)
        }
        root.addView(login, LinearLayout.LayoutParams(-1, dp(58)))

        if (BuildConfig.DEBUG) {
            root.addView(space(12))
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
        val root = column().apply { setBackgroundColor(paper) }
        val header = row().apply {
            setPadding(dp(20), dp(14), dp(14), dp(12))
            setBackgroundColor(ink)
        }
        header.addView(label("F  Faretrack", 22, Color.WHITE, true), LinearLayout.LayoutParams(0, dp(48), 1f))
        header.addView(action("API 설정", Color.WHITE, Color.TRANSPARENT).apply { setOnClickListener { showSettings() } })
        header.addView(action("Logout", Color.WHITE, Color.TRANSPARENT).apply {
            setOnClickListener { auth.logout(); showLogin() }
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
        shell()
        content.addView(label("가격의 흐름을 보고,\n떠날 순간을 정하세요.", 30, ink, true))
        content.addView(space(10))
        content.addView(label("검색 조건을 저장하면 최근 확인 가격을 추적하고 원하는 순간에 알려드립니다.", 14, muted))
        content.addView(space(24))

        val origin = input("출발 공항", "ICN")
        val destination = input("도착 공항", "NRT")
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
            val originCode = origin.text.toString().trim().uppercase()
            val destinationCode = destination.text.toString().trim().uppercase()
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
        val query = lastQuery ?: return
        shell()
        content.addView(label("${query.getString("origin")} → ${query.getString("destination")}", 28, ink, true))
        content.addView(label("현재 확인된 가격 · ${if (response.optBoolean("cached")) "캐시된 결과" else "방금 확인"}", 13, muted))
        content.addView(space(18))
        val flights = response.getJSONArray("flights")
        for (index in 0 until flights.length()) content.addView(flightCard(flights.getJSONObject(index)))
        content.addView(label("표시된 금액은 마지막 확인 기준이며 판매 사이트에서 변경될 수 있습니다.", 12, muted))
    }

    private fun flightCard(flight: JSONObject): View {
        val card = column().apply {
            setPadding(dp(18), dp(18), dp(18), dp(18))
            setBackgroundColor(Color.WHITE)
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
        card.addView(airlineHeader)
        val stops = if (flight.getInt("stops") == 0) "직항" else "경유 ${flight.getInt("stops")}회"
        card.addView(label("${flight.getString("departureTime")}  →  ${flight.getString("arrivalTime")}   ·   $stops", 14, muted))
        card.addView(space(14))
        card.addView(label(won(flight.getInt("price")), 24, ink, true))
        card.addView(
            sellerLogo(flight.getString("seller")),
            LinearLayout.LayoutParams(-2, dp(30)).apply {
                gravity = Gravity.END
                setMargins(0, dp(4), 0, dp(4))
            }
        )
        val buttons = row()
        buttons.addView(action("가격 추적", Color.WHITE, teal).apply {
            setOnClickListener { showTracking(flight) }
        }, LinearLayout.LayoutParams(0, dp(56), 1f))
        buttons.addView(action("판매처 이동", Color.WHITE, ink).apply {
            setOnClickListener { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(flight.optString("bookingUrl", "https://www.google.com/travel/flights")))) }
        }, LinearLayout.LayoutParams(0, dp(56), 1f))
        card.addView(buttons)
        card.layoutParams = LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, 0, 0, dp(12)) }
        return card
    }

    private fun showTracking(flight: JSONObject) {
        val query = lastQuery ?: return
        shell()
        content.addView(label("${query.getString("origin")} → ${query.getString("destination")}", 28, ink, true))
        content.addView(label("현재 확인된 가격", 13, muted))
        content.addView(label(won(flight.getInt("price")), 30, teal, true))
        content.addView(space(20))
        val target = input("목표 가격", "150000").apply { inputType = InputType.TYPE_CLASS_NUMBER }
        val drop = spinner(listOf("5% 이상 하락", "10% 이상 하락", "15% 이상 하락")).apply { setSelection(1) }
        content.addView(field("목표 가격 (원)", target))
        content.addView(field("가격 하락 알림", drop))
        val create = action("가격 알림 등록", Color.WHITE, teal)
        create.setOnClickListener {
            val payload = JSONObject().put("query", query).put("targetPrice", target.text.toString().toInt()).put("dropRatePercent", listOf(5, 10, 15)[drop.selectedItemPosition])
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

    private fun showSettings() {
        shell()
        content.addView(label("API 연결 설정", 28, ink, true))
        content.addView(label("에뮬레이터에서는 10.0.2.2가 개발 PC를 가리킵니다. 실제 기기에서는 PC의 로컬 IP 또는 배포된 HTTPS 주소를 사용하세요.", 14, muted))
        val url = input("API URL", api.baseUrl)
        content.addView(field("Base URL", url))
        val save = action("저장하고 연결 확인", Color.WHITE, teal)
        save.setOnClickListener { api.baseUrl = url.text.toString(); runTask(save, "확인 중...", api::getAlerts) { toast("API 연결에 성공했습니다."); showSearch() } }
        content.addView(save, LinearLayout.LayoutParams(-1, dp(58)))
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
    private fun spinner(values: List<String>) = Spinner(this).apply { adapter = ArrayAdapter(this@MainActivity, android.R.layout.simple_spinner_dropdown_item, values) }
    private fun field(title: String, input: View) = column().apply { setPadding(dp(14), dp(10), dp(14), dp(10)); setBackgroundColor(Color.WHITE); addView(label(title, 12, muted, true)); addView(input, LinearLayout.LayoutParams(-1, dp(52))); layoutParams = LinearLayout.LayoutParams(-1, -2).apply { setMargins(0, 0, 0, dp(10)) } }
    private fun action(value: String, color: Int, background: Int) = Button(this).apply { text = value; setTextColor(color); setBackgroundColor(background); isAllCaps = false }
    private fun sellerLogo(seller: String) = TextView(this).apply {
        val (wordmark, foreground, background) = when (seller.lowercase()) {
            "trip.com" -> Triple("Trip.com", Color.WHITE, Color.rgb(40, 112, 220))
            "kiwi.com" -> Triple("kiwi.com", Color.rgb(0, 82, 73), Color.rgb(220, 245, 239))
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
    private fun pickDate(field: EditText) { val initial = LocalDate.parse(field.text); DatePickerDialog(this, { _, y, m, d -> field.setText(LocalDate.of(y, m + 1, d).toString()) }, initial.year, initial.monthValue - 1, initial.dayOfMonth).show() }
}
