package com.tracora.android.ui.detail

import com.tracora.android.FakeProductApi
import com.tracora.android.data.model.ApiErrorInfo
import com.tracora.android.data.model.Pagination
import com.tracora.android.data.model.ProductDetail
import com.tracora.android.data.model.ProductListItem
import com.tracora.android.data.model.ProductListResponse
import com.tracora.android.data.model.ProductStatus
import com.tracora.android.data.repository.ProductRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Before
import org.junit.Test

private fun failedDetail() = ProductDetail(
    id = "product-1",
    name = "Örnek Ürün",
    url = "https://shop.example/product",
    hostname = "shop.example",
    profile = "generic",
    status = ProductStatus.FAILED,
    notificationsEnabled = true,
    createdAt = "2026-08-01T12:00:00Z",
    lastError = ApiErrorInfo(code = "EXTRACTION_UNSUPPORTED", message = "Fiyat çıkarılamadı."),
)

// FakeProductApi's write endpoints (retry/update/create) return the first item of listResponse,
// so mutation tests need a matching list fixture alongside the detail one.
private fun failedListItem() = ProductListItem(
    id = "product-1",
    name = "Örnek Ürün",
    url = "https://shop.example/product",
    hostname = "shop.example",
    profile = "generic",
    status = ProductStatus.FAILED,
    notificationsEnabled = true,
    createdAt = "2026-08-01T12:00:00Z",
    lastError = ApiErrorInfo(code = "EXTRACTION_UNSUPPORTED", message = "Fiyat çıkarılamadı."),
)

/**
 * ProductDetailViewModel has no recurring/background coroutine (unlike ProductListViewModel's
 * polling loop), so each action settles fully once the dispatcher is advanced — no need for
 * turbine's step-by-step Flow collection here, a direct StateFlow.value read after
 * advanceUntilIdle() is enough and avoids StateFlow's conflation of transient intermediate values.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class ProductDetailViewModelTest {

    private val dispatcher = StandardTestDispatcher()

    @Before
    fun setUp() {
        Dispatchers.setMain(dispatcher)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `load fetches the product detail`() = runTest {
        val api = FakeProductApi(detailResponse = failedDetail())
        val viewModel = ProductDetailViewModel(ProductRepository(api))

        viewModel.load("product-1")
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals("Örnek Ürün", state.product?.name)
        assertEquals(ProductStatus.FAILED, state.product?.status)
    }

    @Test
    fun `retry calls the retry endpoint and settles with no error`() = runTest {
        val api = FakeProductApi(
            listResponse = ProductListResponse(
                items = listOf(failedListItem()),
                pagination = Pagination(page = 1, limit = 100, total = 1, totalPages = 1),
            ),
            detailResponse = failedDetail(),
        )
        val viewModel = ProductDetailViewModel(ProductRepository(api))

        viewModel.load("product-1")
        advanceUntilIdle()

        viewModel.retry()
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertEquals(1, api.retryCalls)
        assertEquals(false, state.isRetrying)
        assertNull(state.actionError)
    }
}
