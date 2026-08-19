package com.faretrack.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL

class ApiClient(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences("faretrack_settings", Context.MODE_PRIVATE)

    var baseUrl: String
        get() = preferences.getString("api_url", BuildConfig.DEFAULT_API_BASE_URL) ?: BuildConfig.DEFAULT_API_BASE_URL
        set(value) { preferences.edit().putString("api_url", value.trim().trimEnd('/')).apply() }

    fun search(query: JSONObject) = requestObject("POST", "/api/flights/search", query)
    fun createAlert(payload: JSONObject) = requestObject("POST", "/api/alerts", payload)
    fun getAlerts() = JSONArray(execute("GET", "/api/alerts"))
    fun updateAlert(id: String, payload: JSONObject) = requestObject("PATCH", "/api/alerts/$id", payload)
    fun deleteAlert(id: String) { execute("DELETE", "/api/alerts/$id") }
    fun runPriceCheck() = requestObject("POST", "/internal/price-check", JSONObject())

    private fun requestObject(method: String, path: String, payload: JSONObject? = null) =
        JSONObject(execute(method, path, payload))

    private fun execute(method: String, path: String, payload: JSONObject? = null): String {
        val connection = URL(baseUrl + path).openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = 10_000
            connection.readTimeout = 15_000
            connection.setRequestProperty("Accept", "application/json")
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
