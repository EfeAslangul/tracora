package com.tracora.android.data.network

import com.tracora.android.data.auth.FirebaseAuthService
import kotlinx.coroutines.runBlocking
import okhttp3.Interceptor
import okhttp3.Response

/** Attaches `Authorization: Bearer <firebase-id-token>` to every request, mirroring
 * apps/web/src/services/api-client.ts's per-request token attachment. Synchronous like the
 * existing debug logging interceptor — OkHttp interceptors run off the main thread already. */
class AuthInterceptor(private val authService: FirebaseAuthService) : Interceptor {
    override fun intercept(chain: Interceptor.Chain): Response {
        val token = runBlocking { authService.currentIdToken() }
        val request = chain.request().let { original ->
            if (token != null) {
                original.newBuilder().addHeader("Authorization", "Bearer $token").build()
            } else {
                original
            }
        }
        val response = chain.proceed(request)
        if (response.code == 401) {
            authService.signOut()
        }
        return response
    }
}
