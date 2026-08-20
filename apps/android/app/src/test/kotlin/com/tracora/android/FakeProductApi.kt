package com.tracora.android

import com.tracora.android.data.model.CheckAcceptedResponse
import com.tracora.android.data.model.CreateProductRequest
import com.tracora.android.data.model.ProductDetail
import com.tracora.android.data.model.ProductListItem
import com.tracora.android.data.model.ProductListResponse
import com.tracora.android.data.model.UpdateProductRequest
import com.tracora.android.data.network.ProductApi
import okhttp3.ResponseBody.Companion.toResponseBody
import retrofit2.Response

/** In-memory fake used by ViewModel tests, mirroring how apps/web mocks product.api.ts with vi.mock. */
class FakeProductApi(
    var listResponse: ProductListResponse = ProductListResponse(items = emptyList(), pagination = FakePagination.empty),
    var detailResponse: ProductDetail? = null,
) : ProductApi {

    var checkCalls = 0
    var retryCalls = 0
    var lastUpdate: UpdateProductRequest? = null
    var deleteCalls = 0

    override suspend fun getProducts(page: Int, limit: Int): Response<ProductListResponse> =
        Response.success(listResponse)

    override suspend fun createProduct(input: CreateProductRequest): Response<ProductListItem> =
        Response.success(listResponse.items.firstOrNull() ?: error("no fixture product configured"))

    override suspend fun getProduct(id: String): Response<ProductDetail> =
        detailResponse?.let { Response.success(it) } ?: Response.error(404, "{}".toResponseBody(null))

    override suspend fun updateProduct(id: String, input: UpdateProductRequest): Response<ProductListItem> {
        lastUpdate = input
        return Response.success(listResponse.items.firstOrNull() ?: error("no fixture product configured"))
    }

    override suspend fun deleteProduct(id: String): Response<Unit> {
        deleteCalls++
        return Response.success(Unit)
    }

    override suspend fun checkProduct(id: String): Response<CheckAcceptedResponse> {
        checkCalls++
        return Response.success(CheckAcceptedResponse(accepted = true, triggeredAt = "2026-08-20T12:00:00Z"))
    }

    override suspend fun retryProduct(id: String): Response<ProductListItem> {
        retryCalls++
        return Response.success(listResponse.items.firstOrNull() ?: error("no fixture product configured"))
    }
}

private object FakePagination {
    val empty = com.tracora.android.data.model.Pagination(page = 1, limit = 100, total = 0, totalPages = 0)
}
