package com.faretrack.app

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.graphics.Typeface
import android.view.MotionEvent
import android.view.View
import org.json.JSONArray
import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import kotlin.math.abs

class PriceHistoryChart(
    context: Context,
    history: JSONArray,
    private val targetPrice: Int? = null
) : View(context) {
    private data class Point(val price: Int, val checkedAt: String, val timestamp: Long?)

    private val points = buildList {
        for (index in 0 until history.length()) {
            val item = history.getJSONObject(index)
            val checkedAt = item.optString("checkedAt")
            add(Point(item.getInt("price"), checkedAt, runCatching { Instant.parse(checkedAt).toEpochMilli() }.getOrNull()))
        }
    }
    private val prices = points.map(Point::price)
    private val lowestPrice = prices.minOrNull()
    private val highestPrice = prices.maxOrNull()
    private val firstTimestamp = points.mapNotNull(Point::timestamp).minOrNull()
    private val lastTimestamp = points.mapNotNull(Point::timestamp).maxOrNull()
    private val numberFormat = NumberFormat.getNumberInstance(Locale.KOREA)
    private var selectedIndex: Int? = null
    private val teal = Color.rgb(8, 127, 118)
    private val red = Color.rgb(190, 55, 45)
    private val grid = Color.rgb(220, 224, 226)
    private val muted = Color.rgb(102, 113, 125)
    private val ink = Color.rgb(23, 33, 43)
    private val linePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = teal
        strokeWidth = dp(3f)
        style = Paint.Style.STROKE
        strokeJoin = Paint.Join.ROUND
        strokeCap = Paint.Cap.ROUND
    }
    private val pointPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = teal }
    private val gridPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = grid
        strokeWidth = dp(1f)
    }
    private val targetPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = red
        strokeWidth = dp(1.5f)
        pathEffect = android.graphics.DashPathEffect(floatArrayOf(dp(6f), dp(5f)), 0f)
    }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = muted
        textSize = dp(11f)
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }
    private val tooltipPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = ink }
    private val tooltipTextPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = Color.WHITE
        textSize = dp(12f)
        typeface = Typeface.create(Typeface.DEFAULT, Typeface.BOLD)
    }

    init {
        isClickable = true
        contentDescription = "가격 변동 그래프. 터치하면 날짜별 가격을 확인할 수 있습니다."
    }

    override fun onDraw(canvas: Canvas) {
        super.onDraw(canvas)
        if (prices.isEmpty()) return

        val left = dp(8f)
        val right = width - dp(8f)
        val top = dp(34f)
        val bottom = height - dp(26f)
        val rawMin = targetPrice?.let { minOf(lowestPrice!!, it) } ?: lowestPrice!!
        val rawMax = targetPrice?.let { maxOf(highestPrice!!, it) } ?: highestPrice!!
        val padding = maxOf(5_000, (rawMax - rawMin) / 5)
        val minPrice = rawMin - padding
        val maxPrice = rawMax + padding
        val range = (maxPrice - minPrice).coerceAtLeast(1).toFloat()

        repeat(3) { index ->
            val y = top + (bottom - top) * index / 2f
            canvas.drawLine(left, y, right, y, gridPaint)
        }

        fun yFor(price: Int) = bottom - (price - minPrice) / range * (bottom - top)

        targetPrice?.let {
            val targetY = yFor(it)
            canvas.drawLine(left, targetY, right, targetY, targetPaint)
            canvas.drawText("목표 ${format(it)}원", left, (targetY - dp(5f)).coerceAtLeast(dp(12f)), textPaint)
        }

        val path = Path()
        prices.forEachIndexed { index, price ->
            val x = xFor(index, left, right)
            val y = yFor(price)
            if (index == 0) path.moveTo(x, y) else path.lineTo(x, y)
        }
        canvas.drawPath(path, linePaint)
        prices.forEachIndexed { index, price ->
            canvas.drawCircle(xFor(index, left, right), yFor(price), dp(4f), pointPaint)
        }

        selectedIndex?.let { index ->
            val point = points[index]
            val x = xFor(index, left, right)
            val y = yFor(point.price)
            canvas.drawLine(x, top, x, bottom, targetPaint)
            canvas.drawCircle(x, y, dp(7f), pointPaint)
            drawTooltip(canvas, x, "${formatDateTime(point.checkedAt)}  ${format(point.price)}원")
        }

        canvas.drawText("최저 ${format(lowestPrice!!)}원", left, height - dp(7f), textPaint)
        val highText = "최고 ${format(highestPrice!!)}원"
        canvas.drawText(highText, right - textPaint.measureText(highText), height - dp(7f), textPaint)
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN, MotionEvent.ACTION_MOVE -> selectNearest(event.x)
            MotionEvent.ACTION_UP -> {
                selectNearest(event.x)
                performClick()
            }
            MotionEvent.ACTION_CANCEL -> clearSelection()
        }
        return true
    }

    override fun onHoverEvent(event: MotionEvent): Boolean {
        when (event.actionMasked) {
            MotionEvent.ACTION_HOVER_ENTER, MotionEvent.ACTION_HOVER_MOVE -> selectNearest(event.x)
            MotionEvent.ACTION_HOVER_EXIT -> clearSelection()
        }
        return true
    }

    override fun performClick(): Boolean {
        super.performClick()
        return true
    }

    private fun selectNearest(touchX: Float) {
        if (points.isEmpty() || width == 0) return
        val left = dp(8f)
        val right = width - dp(8f)
        selectedIndex = points.indices.minByOrNull { index ->
            abs(xFor(index, left, right) - touchX)
        }
        invalidate()
    }

    private fun xFor(index: Int, left: Float, right: Float): Float {
        val timestamp = points[index].timestamp
        return if (timestamp != null && firstTimestamp != null && lastTimestamp != null && lastTimestamp > firstTimestamp) {
            left + (right - left) * (timestamp - firstTimestamp).toFloat() / (lastTimestamp - firstTimestamp).toFloat()
        } else if (points.size == 1) {
            (left + right) / 2f
        } else {
            left + (right - left) * index / (points.size - 1f)
        }
    }

    private fun clearSelection() {
        selectedIndex = null
        invalidate()
    }

    private fun drawTooltip(canvas: Canvas, anchorX: Float, value: String) {
        val horizontalPadding = dp(10f)
        val tooltipWidth = tooltipTextPaint.measureText(value) + horizontalPadding * 2
        val tooltipHeight = dp(28f)
        val left = (anchorX - tooltipWidth / 2).coerceIn(dp(2f), width - tooltipWidth - dp(2f))
        val top = dp(1f)
        canvas.drawRoundRect(left, top, left + tooltipWidth, top + tooltipHeight, dp(4f), dp(4f), tooltipPaint)
        canvas.drawText(value, left + horizontalPadding, top + dp(19f), tooltipTextPaint)
    }

    private fun formatDateTime(value: String): String = runCatching {
        Instant.parse(value)
            .atZone(ZoneId.systemDefault())
            .format(DATE_TIME_FORMATTER)
    }.getOrDefault("조회 가격")

    private fun format(value: Int) = numberFormat.format(value)
    private fun dp(value: Float) = value * resources.displayMetrics.density

    private companion object {
        val DATE_TIME_FORMATTER: DateTimeFormatter = DateTimeFormatter.ofPattern("MM.dd HH:mm")
    }
}
