package com.faretrack.app

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.net.Uri
import net.openid.appauth.AuthState
import net.openid.appauth.AuthorizationException
import net.openid.appauth.AuthorizationRequest
import net.openid.appauth.AuthorizationResponse
import net.openid.appauth.AuthorizationService
import net.openid.appauth.AuthorizationServiceConfiguration
import net.openid.appauth.ResponseTypeValues
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference

class AuthManager(context: Context) {
    private val preferences = context.applicationContext.getSharedPreferences("faretrack_auth", Context.MODE_PRIVATE)
    private val service = AuthorizationService(context.applicationContext)
    private val configuration = AuthorizationServiceConfiguration(
        Uri.parse("${BuildConfig.COGNITO_DOMAIN}/oauth2/authorize"),
        Uri.parse("${BuildConfig.COGNITO_DOMAIN}/oauth2/token")
    )

    private var state = preferences.getString(AUTH_STATE_KEY, null)
        ?.let { runCatching { AuthState.jsonDeserialize(it) }.getOrNull() }
        ?: AuthState(configuration)

    val isAuthorized: Boolean
        get() = state.isAuthorized

    fun authorizationIntent(): Intent {
        val request = AuthorizationRequest.Builder(
            configuration,
            BuildConfig.COGNITO_CLIENT_ID,
            ResponseTypeValues.CODE,
            Uri.parse(BuildConfig.COGNITO_REDIRECT_URI)
        )
            .setScope("openid email profile")
            .build()
        return service.getAuthorizationRequestIntent(request)
    }

    fun handleAuthorizationResult(data: Intent?, callback: (Result<Unit>) -> Unit) {
        if (data == null) {
            callback(Result.failure(IllegalStateException("Login was cancelled.")))
            return
        }

        val response = AuthorizationResponse.fromIntent(data)
        val exception = AuthorizationException.fromIntent(data)
        state.update(response, exception)
        persist()

        if (response == null) {
            callback(Result.failure(exception ?: IllegalStateException("Login failed.")))
            return
        }

        service.performTokenRequest(response.createTokenExchangeRequest()) { tokenResponse, tokenException ->
            state.update(tokenResponse, tokenException)
            persist()
            if (tokenResponse != null) callback(Result.success(Unit))
            else callback(Result.failure(tokenException ?: IllegalStateException("Token exchange failed.")))
        }
    }

    fun freshAccessToken(): String {
        val token = AtomicReference<String?>()
        val failure = AtomicReference<AuthorizationException?>()
        val latch = CountDownLatch(1)

        state.performActionWithFreshTokens(service) { accessToken, _, exception ->
            token.set(accessToken)
            failure.set(exception)
            persist()
            latch.countDown()
        }

        if (!latch.await(20, TimeUnit.SECONDS)) error("Authentication timed out.")
        failure.get()?.let { throw it }
        return token.get() ?: error("Login is required.")
    }

    fun logout() {
        state = AuthState(configuration)
        preferences.edit().remove(AUTH_STATE_KEY).apply()
    }

    fun close() = service.dispose()

    private fun persist() {
        preferences.edit().putString(AUTH_STATE_KEY, state.jsonSerializeString()).apply()
    }

    companion object {
        const val LOGIN_REQUEST_CODE = 4102
        private const val AUTH_STATE_KEY = "auth_state"
    }
}
