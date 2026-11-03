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

    fun authorizationIntent(provider: String): Intent {
        val builder = AuthorizationRequest.Builder(
            configuration,
            BuildConfig.COGNITO_CLIENT_ID,
            ResponseTypeValues.CODE,
            Uri.parse(BuildConfig.COGNITO_REDIRECT_URI)
        )
            .setScope("openid email profile")
            .setAdditionalParameters(mapOf("identity_provider" to provider))
        if (provider.equals("Google", ignoreCase = true)) builder.setPrompt("login select_account")
        val request = builder.build()
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
        failure.get()?.let { exception ->
            val detail = exception.errorDescription?.takeIf { it.isNotBlank() }
                ?: exception.error?.takeIf { it.isNotBlank() }
                ?: exception.cause?.message?.takeIf { it.isNotBlank() }
                ?: "인증 오류 (type=${exception.type}, code=${exception.code})"
            throw IllegalStateException("로그인 인증 갱신 실패: $detail. 로그아웃 후 다시 로그인해 주세요.", exception)
        }
        return token.get() ?: error("Login is required.")
    }

    fun logout() {
        state = AuthState(configuration)
        preferences.edit()
            .remove(AUTH_STATE_KEY)
            .remove(DEVELOPMENT_AUTH_KEY)
            .apply()
    }

    fun logoutIntent(): Intent {
        logout()
        val uri = Uri.parse("${BuildConfig.COGNITO_DOMAIN}/logout").buildUpon()
            .appendQueryParameter("client_id", BuildConfig.COGNITO_CLIENT_ID)
            .appendQueryParameter("logout_uri", BuildConfig.COGNITO_LOGOUT_URI)
            .build()
        return Intent(Intent.ACTION_VIEW, uri)
    }

    fun close() = service.dispose()

    private fun persist() {
        preferences.edit().putString(AUTH_STATE_KEY, state.jsonSerializeString()).apply()
    }

    companion object {
        const val LOGIN_REQUEST_CODE = 4102
        private const val AUTH_STATE_KEY = "auth_state"
        private const val DEVELOPMENT_AUTH_KEY = "development_auth"
    }
}
