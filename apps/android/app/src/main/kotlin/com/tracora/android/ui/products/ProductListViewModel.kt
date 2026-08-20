package com.tracora.android.ui.products

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.tracora.android.data.model.ProductListItem
import com.tracora.android.data.model.ProductStatus
import com.tracora.android.data.network.ApiException
import com.tracora.android.data.repository.ProductRepository
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

data class ProductListUiState(
    val isLoading: Boolean = true,
    val products: List<ProductListItem> = emptyList(),
    val errorMessage: String? = null,
    val addProductError: String? = null,
    val isSubmitting: Boolean = false,
    val retryingIds: Set<String> = emptySet(),
)

/**
 * Polls faster while a product is still awaiting its first check, mirroring the
 * refetchInterval logic in apps/web/src/pages/ProductListPage.tsx.
 */
class ProductListViewModel(private val repository: ProductRepository) : ViewModel() {

    private val _uiState = MutableStateFlow(ProductListUiState())
    val uiState: StateFlow<ProductListUiState> = _uiState.asStateFlow()

    init {
        startPolling()
    }

    private fun startPolling() {
        viewModelScope.launch {
            while (isActive) {
                val awaitingBaseline = refresh()
                delay(if (awaitingBaseline) 3_000 else 60_000)
            }
        }
    }

    /** Returns true if any product is still awaiting its baseline check. */
    private suspend fun refresh(): Boolean {
        return try {
            val response = repository.getProducts()
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                products = response.items,
                errorMessage = null,
            )
            response.items.any {
                it.status == ProductStatus.PENDING ||
                    (it.status == ProductStatus.ACTIVE && it.lastSuccessfulCheckAt == null)
            }
        } catch (error: Exception) {
            _uiState.value = _uiState.value.copy(
                isLoading = false,
                errorMessage = "Ürünler alınamadı. Biraz sonra tekrar deneyin.",
            )
            false
        }
    }

    fun addProduct(url: String, targetPrice: Double?, notificationsEnabled: Boolean) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(isSubmitting = true, addProductError = null)
            try {
                repository.createProduct(url, targetPrice, notificationsEnabled)
                refresh()
                _uiState.value = _uiState.value.copy(isSubmitting = false)
            } catch (error: ApiException) {
                _uiState.value = _uiState.value.copy(isSubmitting = false, addProductError = error.message)
            } catch (error: Exception) {
                _uiState.value = _uiState.value.copy(isSubmitting = false, addProductError = "Ürün eklenemedi.")
            }
        }
    }

    fun retryProduct(id: String) {
        viewModelScope.launch {
            _uiState.value = _uiState.value.copy(retryingIds = _uiState.value.retryingIds + id)
            try {
                repository.retryProduct(id)
                refresh()
            } catch (error: Exception) {
                // The failed status/message already surfaces via the product list itself.
            } finally {
                _uiState.value = _uiState.value.copy(retryingIds = _uiState.value.retryingIds - id)
            }
        }
    }
}
