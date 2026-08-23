package com.tracora.android.ui.settings

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tracora.android.data.auth.FirebaseAuthService
import com.tracora.android.data.repository.ProductRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class SettingsUiState(
    val isDeleting: Boolean = false,
    val errorMessage: String? = null,
)

class SettingsViewModel(
    private val repository: ProductRepository,
    private val authService: FirebaseAuthService,
) : ViewModel() {
    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    fun signOut() = authService.signOut()

    fun deleteAccount(onDeleted: () -> Unit) {
        viewModelScope.launch {
            _uiState.update { it.copy(isDeleting = true, errorMessage = null) }
            runCatching {
                repository.deleteMe()
                authService.deleteAccount()
            }.onSuccess {
                _uiState.update { it.copy(isDeleting = false) }
                onDeleted()
            }.onFailure { error ->
                _uiState.update { it.copy(isDeleting = false, errorMessage = error.message) }
            }
        }
    }
}
