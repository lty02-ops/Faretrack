package com.faretrack.app

import android.content.Context
import org.json.JSONArray
import org.json.JSONObject
import java.time.Instant
import java.util.UUID

class DevelopmentApi(context: Context) {
    private val preferences = context.getSharedPreferences("faretrack_development_data", Context.MODE_PRIVATE)

    fun search(query: JSONObject): JSONObject {
        val origin = query.getString("origin")
        val destination = query.getString("destination")
        val seed = (origin + destination).sumOf(Char::code)
        val basePrice = 128_000 + (seed % 7) * 9_000
        val flights = JSONArray()
            .put(flight("Korean Air", "KE703", "09:55", "12:20", 0, basePrice, "Google Flights"))
            .put(flight("Asiana Airlines", "OZ102", "10:50", "13:15", 0, basePrice + 17_400, "Trip.com"))
            .put(flight("Jeju Air", "7C1102", "08:10", "10:35", 0, basePrice + 6_200, "Google Flights"))
            .put(flight("Jin Air", "LJ203", "15:20", "17:45", 1, basePrice - 5_800, "Kiwi.com"))

        return JSONObject()
            .put("key", "$origin-$destination-${query.getString("departureDate")}")
            .put("flights", flights)
            .put("cached", false)
    }

    fun createAlert(payload: JSONObject): JSONObject {
        val query = JSONObject(payload.getJSONObject("query").toString())
        val initialPrice = search(query).getJSONArray("flights").getJSONObject(0).getInt("price")
        val now = Instant.now()
        val history = JSONArray()
            .put(pricePoint(initialPrice + 18_000, now.minusSeconds(12 * 3_600L)))
            .put(pricePoint(initialPrice + 9_500, now.minusSeconds(9 * 3_600L)))
            .put(pricePoint(initialPrice + 13_000, now.minusSeconds(6 * 3_600L)))
            .put(pricePoint(initialPrice + 4_200, now.minusSeconds(3 * 3_600L)))
            .put(pricePoint(initialPrice, now))
        val alert = JSONObject()
            .put("id", UUID.randomUUID().toString())
            .put("targetPrice", payload.getInt("targetPrice"))
            .put("dropRatePercent", payload.optInt("dropRatePercent", 10))
            .put("active", true)
            .put("target", JSONObject().put("query", query))
            .put("history", history)

        val alerts = loadAlerts().put(alert)
        saveAlerts(alerts)
        return JSONObject(alert.toString())
    }

    fun getAlerts(): JSONArray = JSONArray(loadAlerts().toString())

    fun updateAlert(id: String, payload: JSONObject): JSONObject {
        val alerts = loadAlerts()
        val alert = find(alerts, id) ?: error("Tracking item not found.")
        if (payload.has("active")) alert.put("active", payload.getBoolean("active"))
        if (payload.has("targetPrice")) alert.put("targetPrice", payload.getInt("targetPrice"))
        saveAlerts(alerts)
        return JSONObject(alert.toString())
    }

    fun deleteAlert(id: String) {
        val current = loadAlerts()
        val next = JSONArray()
        for (index in 0 until current.length()) {
            val item = current.getJSONObject(index)
            if (item.getString("id") != id) next.put(item)
        }
        saveAlerts(next)
    }

    fun runPriceCheck(): JSONObject {
        val alerts = loadAlerts()
        var checked = 0
        for (index in 0 until alerts.length()) {
            val alert = alerts.getJSONObject(index)
            if (!alert.optBoolean("active")) continue
            val history = alert.getJSONArray("history")
            val previous = history.getJSONObject(history.length() - 1).getInt("price")
            val adjustment = if (history.length() % 2 == 0) 3_200 else -4_700
            history.put(pricePoint((previous + adjustment).coerceAtLeast(50_000)))
            checked++
        }
        saveAlerts(alerts)
        return JSONObject().put("checkedTargets", checked)
    }

    private fun flight(
        airline: String,
        flightNumber: String,
        departureTime: String,
        arrivalTime: String,
        stops: Int,
        price: Int,
        seller: String
    ) = JSONObject()
        .put("id", "flight_${UUID.randomUUID().toString().take(8)}")
        .put("airline", airline)
        .put("flightNumber", flightNumber)
        .put("departureTime", departureTime)
        .put("arrivalTime", arrivalTime)
        .put("stops", stops)
        .put("price", price)
        .put("seller", seller)
        .put("bookingUrl", "https://www.google.com/travel/flights")

    private fun pricePoint(price: Int, checkedAt: Instant = Instant.now()) = JSONObject()
        .put("price", price)
        .put("checkedAt", checkedAt.toString())

    private fun loadAlerts(): JSONArray {
        val raw = preferences.getString(ALERTS_KEY, "[]") ?: "[]"
        return runCatching { JSONArray(raw) }.getOrDefault(JSONArray())
    }

    private fun saveAlerts(alerts: JSONArray) {
        preferences.edit().putString(ALERTS_KEY, alerts.toString()).apply()
    }

    private fun find(alerts: JSONArray, id: String): JSONObject? {
        for (index in 0 until alerts.length()) {
            val item = alerts.getJSONObject(index)
            if (item.getString("id") == id) return item
        }
        return null
    }

    companion object {
        private const val ALERTS_KEY = "alerts"
    }
}
