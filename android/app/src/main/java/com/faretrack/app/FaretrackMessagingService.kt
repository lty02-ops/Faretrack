package com.faretrack.app

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.os.Build
import androidx.core.app.NotificationCompat
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import kotlin.concurrent.thread

class FaretrackMessagingService : FirebaseMessagingService() {
    override fun onNewToken(token: String) {
        val auth = AuthManager(this)
        if (auth.isAuthorized) thread { runCatching { ApiClient(this, auth).registerDevice(token) }; auth.close() }
        else auth.close()
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val manager = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "가격 하락 알림", NotificationManager.IMPORTANCE_HIGH)
        )
        val intent = Intent(this, MainActivity::class.java)
            .putExtra(MainActivity.EXTRA_OPEN_WATCHES, true)
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pending = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val notification = NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher)
            .setContentTitle(message.data["title"] ?: message.notification?.title ?: "Faretrack 가격 알림")
            .setContentText(message.data["body"] ?: message.notification?.body ?: "추적 중인 항공권 가격이 변경되었습니다.")
            .setAutoCancel(true)
            .setContentIntent(pending)
            .build()
        manager.notify(System.currentTimeMillis().toInt(), notification)
    }

    companion object { private const val CHANNEL_ID = "faretrack_price_alerts" }
}
