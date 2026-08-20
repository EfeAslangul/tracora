package com.tracora.android.ui.detail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tracora.android.data.model.ProductDetail
import com.tracora.android.data.model.ProductStatus
import com.tracora.android.data.network.ApiException
import com.tracora.android.data.repository.ProductRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class ProductDetailUiState(
    val isLoading: Boolean = true,
    val product: ProductDetail? = null,
    val loadError: String? = null,
    val actionError: String? = null,
    val isChecking: Boolean = false,
    val isRetrying: Boolean = false,
    val isTogglingStatus: Boolean = false,
    val isDeleting: Boolean = false,
    val deleted: Boolean = false,
)

class ProductDetailViewModel(private val repository: ProductRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(ProductDetailUiState())
    val uiState: StateFlow<ProductDetailUiState> = _uiState.asStateFlow()

    private var productId: String? = null

    fun load(id: String) {
        if (productId == id && _uiState.value.product != null) return
        productId = id
        refresh()
    }

    private fun refresh() {
        val id = productId ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isLoading = true, loadError = null)
            try {
                val detail = repository.getProduct(id)
                _uiState.value = _uiState.value.copy(isLoading = false, product = detail)
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(
                    isLoading = false,
                    loadError = "Ürün alınamadı. Biraz sonra tekrar deneyin.",
                )
            }
        }
    }

    fun checkNow() = runAction(
        setBusy = { copy(isChecking = it) },
        action = { repository.checkProduct(it) },
    )

    fun retry() = runAction(
        setBusy = { copy(isRetrying = it) },
        action = { repository.retryProduct(it) },
    )

    fun toggleStatus() {
        val current = _uiState.value.product ?: return
        val nextStatus = if (current.status == ProductStatus.PAUSED) ProductStatus.ACTIVE else ProductStatus.PAUSED
        runAction(
            setBusy = { copy(isTogglingStatus = it) },
            action = { repository.setStatus(it, nextStatus) },
        )
    }

    fun delete() {
        val id = productId ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isDeleting = true, actionError = null)
            try {
                repository.deleteProduct(id)
                _uiState.value = _uiState.value.copy(isDeleting = false, deleted = true)
            } catch (error: ApiException) {
                _uiState.value = _uiState.value.copy(isDeleting = false, actionError = error.message)
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(isDeleting = false, actionError = "İşlem tamamlanamadı.")
            }
        }
    }

    private fun runAction(
        setBusy: ProductDetailUiState.(Boolean) -> ProductDetailUiState,
        action: suspend (String) -> Unit,
    ) {
        val id = productId ?: return
        viewModelScope.launch {
            _uiState.value = _uiState.value.setBusy(true).copy(actionError = null)
            try {
                action(id)
                refresh()
            } catch (error: ApiException) {
                _uiState.value = _uiState.value.copy(actionError = error.message)
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(actionError = "İşlem tamamlanamadı.")
            } finally {
                _uiState.value = _uiState.value.setBusy(false)
            }
        }
    }
}
