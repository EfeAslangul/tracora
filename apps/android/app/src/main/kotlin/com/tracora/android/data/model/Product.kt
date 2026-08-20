package com.tracora.android.data.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
enum class ProductStatus {
    PENDING,
    ACTIVE,
    PAUSED,
    FAILED,
}

@Serializable
data class ApiErrorInfo(
    val code: String,
    val message: String,
)

@Serializable
data class ProductListItem(
    val id: String,
    val name: String? = null,
    val url: String,
    val hostname: String,
    val profile: String,
    val imageUrl: String? = null,
    val status: ProductStatus,
    val currentPrice: Double? = null,
    val previousPrice: Double? = null,
    val currency: String? = null,
    val targetPrice: Double? = null,
    val inStock: Boolean? = null,
    val notificationsEnabled: Boolean,
    val lastCheckedAt: String? = null,
    val lastSuccessfulCheckAt: String? = null,
    val lastError: ApiErrorInfo? = null,
    val createdAt: String,
)

@Serializable
data class ProductListResponse(
    val items: List<ProductListItem>,
    val pagination: Pagination,
)

@Serializable
data class Pagination(
    val page: Int,
    val limit: Int,
    val total: Int,
    val totalPages: Int,
)

@Serializable
data class PriceHistoryPoint(
    val price: Double,
    val currency: String,
    val observedAt: String,
)

@Serializable
data class StockHistoryPoint(
    val inStock: Boolean,
    val observedAt: String,
)

@Serializable
data class ProductEvent(
    val type: String,
    val code: String? = null,
    val message: String,
    val createdAt: String,
)

@Serializable
data class ProductDetail(
    val id: String,
    val name: String? = null,
    val url: String,
    val hostname: String,
    val profile: String,
    val imageUrl: String? = null,
    val status: ProductStatus,
    val currentPrice: Double? = null,
    val previousPrice: Double? = null,
    val currency: String? = null,
    val targetPrice: Double? = null,
    val inStock: Boolean? = null,
    val notificationsEnabled: Boolean,
    val lastCheckedAt: String? = null,
    val lastSuccessfulCheckAt: String? = null,
    val lastError: ApiErrorInfo? = null,
    val createdAt: String,
    val watchId: String? = null,
    val fetchMode: String? = null,
    val priceHistory: List<PriceHistoryPoint> = emptyList(),
    val stockHistory: List<StockHistoryPoint> = emptyList(),
    val recentEvents: List<ProductEvent> = emptyList(),
)

@Serializable
data class CreateProductRequest(
    val url: String,
    val targetPrice: Double? = null,
    val notificationsEnabled: Boolean,
)

@Serializable
data class UpdateProductRequest(
    val targetPrice: Double? = null,
    val notificationsEnabled: Boolean? = null,
    val status: ProductStatus? = null,
)

@Serializable
data class CheckAcceptedResponse(
    val accepted: Boolean,
    val triggeredAt: String,
)

@Serializable
data class ApiErrorBody(
    val code: String,
    val message: String,
    val details: JsonObject? = null,
    @SerialName("requestId") val requestId: String = "",
)
