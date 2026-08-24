package com.faretrack.app

import android.app.Activity
import android.os.Bundle
import android.webkit.WebView
import android.webkit.WebViewClient

class BookingActivity : Activity() {
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val url = intent.getStringExtra(EXTRA_URL).orEmpty()
        if (!url.startsWith("https://")) {
            finish()
            return
        }
        webView = WebView(this).apply {
            webViewClient = WebViewClient()
            settings.javaScriptEnabled = true
            settings.domStorageEnabled = true
            settings.allowFileAccess = false
            settings.allowContentAccess = false
        }
        setContentView(webView)
        val postData = intent.getStringExtra(EXTRA_POST_DATA).orEmpty()
        if (postData.isNotEmpty()) webView.postUrl(url, postData.toByteArray(Charsets.UTF_8)) else webView.loadUrl(url)
    }

    @Deprecated("Use OnBackInvokedDispatcher on newer Android versions")
    override fun onBackPressed() {
        if (::webView.isInitialized && webView.canGoBack()) webView.goBack() else super.onBackPressed()
    }

    companion object {
        const val EXTRA_URL = "booking_url"
        const val EXTRA_POST_DATA = "booking_post_data"
    }
}
