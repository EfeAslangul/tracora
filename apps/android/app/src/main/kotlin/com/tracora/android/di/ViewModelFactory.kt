package com.tracora.android.di

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.CreationExtras
import com.tracora.android.data.auth.FirebaseAuthService
import com.tracora.android.data.repository.ProductRepository
import com.tracora.android.ui.auth.LoginViewModel
import com.tracora.android.ui.detail.ProductDetailViewModel
import com.tracora.android.ui.onboarding.OnboardingViewModel
import com.tracora.android.ui.products.ProductListViewModel
import com.tracora.android.ui.settings.SettingsViewModel

/** Simple factory pairing with [AppContainer] since the app doesn't use Hilt. */
class ViewModelFactory(
    private val repository: ProductRepository = AppContainer.productRepository,
    private val authService: FirebaseAuthService = AppContainer.firebaseAuthService,
) : ViewModelProvider.Factory {

    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T {
        return when (modelClass) {
            ProductListViewModel::class.java -> ProductListViewModel(repository) as T
            ProductDetailViewModel::class.java -> ProductDetailViewModel(repository) as T
            LoginViewModel::class.java -> LoginViewModel(authService) as T
            OnboardingViewModel::class.java -> OnboardingViewModel(repository) as T
            SettingsViewModel::class.java -> SettingsViewModel(repository, authService) as T
            else -> throw IllegalArgumentException("Unknown ViewModel class: $modelClass")
        }
    }
}
