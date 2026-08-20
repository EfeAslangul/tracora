package com.tracora.android.ui.products

import androidx.lifecycle.viewModelScope
import app.cash.turbine.test
import com.tracora.android.FakeProductApi
import com.tracora.android.data.model.Pagination
import com.tracora.android.data.model.ProductListItem
import com.tracora.android.data.model.ProductListResponse
import com.tracora.android.data.model.ProductStatus
import com.tracora.android.data.repository.ProductRepository
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.cancel
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

private fun failedProduct() = ProductListItem(
    id = "product-1",
    name = "Başarısız Ürün",
    url = "https://shop.example/product",
    hostname = "shop.example",
    profile = "generic",
    status = ProductStatus.FAILED,
    notificationsEnabled = true,
    createdAt = "2026-08-01T12:00:00Z",
)

@OptIn(ExperimentalCoroutinesApi::class)
class ProductListViewModelTest {

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
    fun `loads products and exposes the FAILED product for retry`() = runTest {
        val api = FakeProductApi(
            listResponse = ProductListResponse(
                items = listOf(failedProduct()),
                pagination = Pagination(page = 1, limit = 100, total = 1, totalPages = 1),
            ),
        )
        val viewModel = ProductListViewModel(ProductRepository(api))

        viewModel.uiState.test {
            var state = awaitItem()
            while (state.isLoading) state = awaitItem()

            assertEquals(1, state.products.size)
            assertEquals(ProductStatus.FAILED, state.products.first().status)
        }

        viewModel.viewModelScope.cancel()
    }

    @Test
    fun `retryProduct calls the retry endpoint and clears the pending flag`() = runTest {
        val api = FakeProductApi(
            listResponse = ProductListResponse(
                items = listOf(failedProduct()),
                pagination = Pagination(page = 1, limit = 100, total = 1, totalPages = 1),
            ),
        )
        val viewModel = ProductListViewModel(ProductRepository(api))

        viewModel.uiState.test {
            var state = awaitItem()
            while (state.isLoading) state = awaitItem()

            viewModel.retryProduct("product-1")

            state = awaitItem()
            assertTrue("product-1" in state.retryingIds)

            while ("product-1" in state.retryingIds) state = awaitItem()
        }

        viewModel.viewModelScope.cancel()
        assertEquals(1, api.retryCalls)
    }
}
