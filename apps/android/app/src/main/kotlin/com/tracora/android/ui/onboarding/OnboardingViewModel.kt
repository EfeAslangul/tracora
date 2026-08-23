package com.tracora.android.ui.onboarding

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tracora.android.data.model.SetupProductInput
import com.tracora.android.data.repository.ProductRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

private const val MAX_ONBOARDING_URLS = 20

data class OnboardingUiState(
    val urls: List<String> = listOf(""),
    val isSubmitting: Boolean = false,
    val errorMessage: String? = null,
) {
    val validCount: Int get() = urls.count { it.isNotBlank() }
    val canAddMore: Boolean get() = urls.size < MAX_ONBOARDING_URLS
}

class OnboardingViewModel(private val repository: ProductRepository) : ViewModel() {
    private val _uiState = MutableStateFlow(OnboardingUiState())
    val uiState: StateFlow<OnboardingUiState> = _uiState.asStateFlow()

    fun updateUrl(index: Int, value: String) = _uiState.update { state ->
        state.copy(urls = state.urls.toMutableList().also { it[index] = value })
    }

    fun addRow() = _uiState.update { state ->
        if (state.canAddMore) state.copy(urls = state.urls + "") else state
    }

    fun removeRow(index: Int) = _uiState.update { state ->
        if (state.urls.size > 1) state.copy(urls = state.urls.toMutableList().also { it.removeAt(index) }) else state
    }

    fun submit(onCompleted: () -> Unit) {
        val products = _uiState.value.urls
            .map { it.trim() }
            .filter { it.isNotEmpty() }
            .map { SetupProductInput(url = it, targetPrice = null, notificationsEnabled = true) }

        if (products.isEmpty()) {
            _uiState.update { it.copy(errorMessage = "En az bir ürün bağlantısı ekleyin.") }
            return
        }

        viewModelScope.launch {
            _uiState.update { it.copy(isSubmitting = true, errorMessage = null) }
            runCatching { repository.postSetup(products) }
                .onSuccess { result ->
                    _uiState.update { it.copy(isSubmitting = false) }
                    if (result.completed) onCompleted() else _uiState.update { it.copy(errorMessage = "Hiçbir bağlantı takibe alınamadı.") }
                }
                .onFailure { error ->
                    _uiState.update { it.copy(isSubmitting = false, errorMessage = error.message) }
                }
        }
    }
}
