package com.tracora.android.di

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewmodel.CreationExtras
import com.tracora.android.data.repository.ProductRepository
import com.tracora.android.ui.detail.ProductDetailViewModel
import com.tracora.android.ui.products.ProductListViewModel

/** Simple factory pairing with [AppContainer] since the app doesn't use Hilt. */
class ViewModelFactory(private val repository: ProductRepository = AppContainer.productRepository) :
    ViewModelProvider.Factory {

    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>, extras: CreationExtras): T {
        return when (modelClass) {
            ProductListViewModel::class.java -> ProductListViewModel(repository) as T
            ProductDetailViewModel::class.java -> ProductDetailViewModel(repository) as T
            else -> throw IllegalArgumentException("Unknown ViewModel class: $modelClass")
        }
    }
}
