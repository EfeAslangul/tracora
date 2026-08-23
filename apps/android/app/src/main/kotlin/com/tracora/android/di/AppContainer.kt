package com.tracora.android.di

import com.tracora.android.BuildConfig
import com.tracora.android.data.auth.FirebaseAuthService
import com.tracora.android.data.network.ApiClient
import com.tracora.android.data.repository.ProductRepository

/**
 * Minimal hand-rolled service locator. The app has a handful of screens and one repository, so a
 * DI framework (Hilt) would add build-time cost without buying us much yet.
 */
object AppContainer {
    val firebaseAuthService: FirebaseAuthService by lazy { FirebaseAuthService() }

    val productRepository: ProductRepository by lazy {
        val api = ApiClient.create(
            baseUrl = BuildConfig.API_BASE_URL,
            debug = BuildConfig.DEBUG,
            authService = firebaseAuthService,
        )
        ProductRepository(api)
    }
}
