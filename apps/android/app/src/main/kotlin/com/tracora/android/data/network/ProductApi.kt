package com.tracora.android.data.network

import com.tracora.android.data.model.CheckAcceptedResponse
import com.tracora.android.data.model.CreateProductRequest
import com.tracora.android.data.model.ProductDetail
import com.tracora.android.data.model.ProductListItem
import com.tracora.android.data.model.ProductListResponse
import com.tracora.android.data.model.UpdateProductRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/** Mirrors the REST contract documented in docs/API.md and consumed by apps/web/src/features/products. */
interface ProductApi {
    @GET("products")
    suspend fun getProducts(
        @Query("page") page: Int = 1,
        @Query("limit") limit: Int = 100,
    ): Response<ProductListResponse>

    @POST("products")
    suspend fun createProduct(@Body input: CreateProductRequest): Response<ProductListItem>

    @GET("products/{id}")
    suspend fun getProduct(@Path("id") id: String): Response<ProductDetail>

    @PATCH("products/{id}")
    suspend fun updateProduct(
        @Path("id") id: String,
        @Body input: UpdateProductRequest,
    ): Response<ProductListItem>

    @DELETE("products/{id}")
    suspend fun deleteProduct(@Path("id") id: String): Response<Unit>

    @POST("products/{id}/check")
    suspend fun checkProduct(@Path("id") id: String): Response<CheckAcceptedResponse>

    @POST("products/{id}/retry")
    suspend fun retryProduct(@Path("id") id: String): Response<ProductListItem>
}
