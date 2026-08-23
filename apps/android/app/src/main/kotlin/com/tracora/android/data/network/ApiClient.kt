package com.tracora.android.data.network

import com.jakewharton.retrofit2.converter.kotlinx.serialization.asConverterFactory
import com.tracora.android.data.auth.FirebaseAuthService
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit

object ApiClient {
    private val json = Json {
        ignoreUnknownKeys = true
        explicitNulls = false
    }

    fun create(baseUrl: String, debug: Boolean, authService: FirebaseAuthService): ProductApi {
        val client = OkHttpClient.Builder()
            .addInterceptor(AuthInterceptor(authService))
            .apply {
                if (debug) {
                    addInterceptor(HttpLoggingInterceptor().apply { level = HttpLoggingInterceptor.Level.BODY })
                }
            }
            .build()

        val retrofit = Retrofit.Builder()
            .baseUrl(if (baseUrl.endsWith("/")) baseUrl else "$baseUrl/")
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()

        return retrofit.create(ProductApi::class.java)
    }
}
