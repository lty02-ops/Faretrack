package com.faretrack.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class ApiClient(context: Context, private val auth: AuthManager) {
    private val preferences = context.applicationContext.getSharedPreferences("faretrack_settings", Context.MODE_PRIVATE)
    private val developmentApi = DevelopmentApi(context.applicationContext)

    var baseUrl: String
        get() = preferences.getString("api_url", BuildConfig.DEFAULT_API_BASE_URL) ?: BuildConfig.DEFAULT_API_BASE_URL
        set(value) { preferences.edit().putString("api_url", value.trim().trimEnd('/')).apply() }

    fun search(query: JSONObject) = if (useDevelopmentApi) developmentApi.search(query)
        else requestObject("POST", "/api/flights/search", query)

    fun createAlert(payload: JSONObject) = if (useDevelopmentApi) developmentApi.createAlert(payload)
        else requestObject("POST", "/api/alerts", payload)

    fun getAlerts() = if (useDevelopmentApi) developmentApi.getAlerts()
        else JSONArray(execute("GET", "/api/alerts"))

    fun updateAlert(id: String, payload: JSONObject) = if (useDevelopmentApi) developmentApi.updateAlert(id, payload)
        else requestObject("PATCH", "/api/alerts/$id", payload)

    fun deleteAlert(id: String) {
        if (useDevelopmentApi) developmentApi.deleteAlert(id) else execute("DELETE", "/api/alerts/$id")
    }

    fun runPriceCheck() = if (useDevelopmentApi) developmentApi.runPriceCheck()
        else requestObject("POST", "/internal/price-check", JSONObject())

    private val useDevelopmentApi: Boolean
        get() = BuildConfig.DEBUG && auth.isDevelopmentAuthorized

    private fun requestObject(method: String, path: String, payload: JSONObject? = null) =
        JSONObject(execute(method, path, payload))

    private fun execute(method: String, path: String, payload: JSONObject? = null): String {
        val connection = URL(baseUrl + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 10_000
            connection.readTimeout = 15_000
            connection.setRequestProperty("Accept", "application/json")
            connection.setRequestProperty("Authorization", "Bearer ${auth.freshAccessToken()}")
            payload?.let {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
                connection.outputStream.use { output -> output.write(it.toString().toByteArray(Charsets.UTF_8)) }
            }
            val status = connection.responseCode
            val response = (if (status >= 400) connection.errorStream else connection.inputStream)
                ?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (status >= 400) {
                val fallback = "요청 실패 ($status)"
                val message = runCatching { JSONObject(response).optString("error", fallback) }.getOrDefault(fallback)
                error(message)
            }
            return response.ifEmpty { "{}" }
        } finally {
            connection.disconnect()
        }
    }
}
