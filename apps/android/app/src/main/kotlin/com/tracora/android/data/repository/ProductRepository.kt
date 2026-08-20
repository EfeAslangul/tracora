package com.tracora.android.data.repository

import com.tracora.android.data.model.ApiErrorBody
import com.tracora.android.data.model.CheckAcceptedResponse
import com.tracora.android.data.model.CreateProductRequest
import com.tracora.android.data.model.ProductDetail
import com.tracora.android.data.model.ProductListItem
import com.tracora.android.data.model.ProductListResponse
import com.tracora.android.data.model.ProductStatus
import com.tracora.android.data.model.UpdateProductRequest
import com.tracora.android.data.network.ApiException
import com.tracora.android.data.network.ProductApi
import kotlinx.serialization.json.Json
import retrofit2.Response

/**
 * Unwraps Retrofit [Response]s into either the parsed body or an [ApiException], mirroring
 * apps/web/src/services/api-client.ts's ApiClient.request().
 */
class ProductRepository(private val api: ProductApi) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun getProducts(): ProductListResponse = unwrap(api.getProducts())

    suspend fun createProduct(url: String, targetPrice: Double?, notificationsEnabled: Boolean): ProductListItem =
        unwrap(api.createProduct(CreateProductRequest(url, targetPrice, notificationsEnabled)))

    suspend fun getProduct(id: String): ProductDetail = unwrap(api.getProduct(id))

    suspend fun setStatus(id: String, status: ProductStatus): ProductListItem =
        unwrap(api.updateProduct(id, UpdateProductRequest(status = status)))

    suspend fun deleteProduct(id: String) {
        unwrap(api.deleteProduct(id))
    }

    suspend fun checkProduct(id: String): CheckAcceptedResponse = unwrap(api.checkProduct(id))

    suspend fun retryProduct(id: String): ProductListItem = unwrap(api.retryProduct(id))

    @Suppress("UNCHECKED_CAST")
    private fun <T> unwrap(response: Response<T>): T {
        if (response.isSuccessful) {
            return response.body() ?: Unit as T
        }
        val errorText = response.errorBody()?.string()
        val body = errorText?.let { runCatching { json.decodeFromString<ApiErrorBody>(it) }.getOrNull() }
            ?: ApiErrorBody(code = "REQUEST_FAILED", message = "İstek şu anda tamamlanamadı.")
        throw ApiException(response.code(), body)
    }
}
