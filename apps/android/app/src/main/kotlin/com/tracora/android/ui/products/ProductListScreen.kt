package com.tracora.android.ui.products

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExtendedFloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tracora.android.data.model.ProductListItem
import com.tracora.android.data.model.ProductStatus
import com.tracora.android.di.ViewModelFactory

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductListScreen(
    onProductClick: (String) -> Unit,
    viewModel: ProductListViewModel = viewModel(factory = ViewModelFactory()),
) {
    val state by viewModel.uiState.collectAsState()
    var showAddSheet by remember { mutableStateOf(false) }

    Scaffold(
        topBar = { TopAppBar(title = { Text("Ürünler") }) },
        floatingActionButton = {
            ExtendedFloatingActionButton(onClick = { showAddSheet = true }) {
                Icon(Icons.Filled.Add, contentDescription = null)
                Text("Ürün ekle", modifier = Modifier.padding(start = 8.dp))
            }
        },
    ) { padding ->
        when {
            state.isLoading -> Column(
                modifier = Modifier.fillMaxSize().padding(padding),
                verticalArrangement = Arrangement.Center,
            ) {
                CircularProgressIndicator(modifier = Modifier.padding(16.dp))
            }

            state.errorMessage != null -> Text(
                text = state.errorMessage!!,
                modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            )

            state.products.isEmpty() -> Text(
                text = "Henüz izlenen ürün yok.",
                modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            )

            else -> LazyColumn(
                modifier = Modifier.fillMaxSize().padding(padding),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(state.products, key = { it.id }) { product ->
                    ProductCard(
                        product = product,
                        isRetrying = product.id in state.retryingIds,
                        onClick = { onProductClick(product.id) },
                        onRetry = { viewModel.retryProduct(product.id) },
                    )
                }
            }
        }
    }

    if (showAddSheet) {
        AddProductSheet(
            isSubmitting = state.isSubmitting,
            errorMessage = state.addProductError,
            onDismiss = { showAddSheet = false },
            onSubmit = { url, targetPrice, notificationsEnabled ->
                viewModel.addProduct(url, targetPrice, notificationsEnabled)
            },
        )
    }
}

@Composable
private fun ProductCard(
    product: ProductListItem,
    isRetrying: Boolean,
    onClick: () -> Unit,
    onRetry: () -> Unit,
) {
    Card(modifier = Modifier.fillMaxWidth().padding(0.dp)) {
        Column(modifier = Modifier.padding(16.dp)) {
            Text(text = product.status.name)
            Text(text = product.name ?: product.hostname, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(text = product.currentPrice?.let { "${it} ${product.currency ?: ""}" } ?: "İlk kontrol bekleniyor")
            product.lastError?.let { Text(text = it.message) }
            Column(modifier = Modifier.padding(top = 12.dp)) {
                Button(onClick = onClick) { Text("Detaylar") }
                if (product.status == ProductStatus.FAILED) {
                    Button(onClick = onRetry, enabled = !isRetrying) {
                        Text(if (isRetrying) "Yeniden deneniyor…" else "Yeniden dene")
                    }
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddProductSheet(
    isSubmitting: Boolean,
    errorMessage: String?,
    onDismiss: () -> Unit,
    onSubmit: (url: String, targetPrice: Double?, notificationsEnabled: Boolean) -> Unit,
) {
    var url by remember { mutableStateOf("") }
    var targetPrice by remember { mutableStateOf("") }
    var notificationsEnabled by remember { mutableStateOf(true) }

    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = rememberModalBottomSheetState()) {
        Column(modifier = Modifier.fillMaxWidth().padding(24.dp)) {
            Text("Yeni ürün ekle")
            OutlinedTextField(
                value = url,
                onValueChange = { url = it },
                label = { Text("Ürün bağlantısı") },
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            )
            OutlinedTextField(
                value = targetPrice,
                onValueChange = { targetPrice = it },
                label = { Text("Hedef fiyat") },
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            )
            Column(modifier = Modifier.padding(top = 12.dp)) {
                Text("Bildirim açık")
                Switch(checked = notificationsEnabled, onCheckedChange = { notificationsEnabled = it })
            }
            errorMessage?.let { Text(text = it, modifier = Modifier.padding(top = 8.dp)) }
            Button(
                enabled = !isSubmitting && url.isNotBlank(),
                onClick = {
                    onSubmit(url, targetPrice.toDoubleOrNull(), notificationsEnabled)
                },
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            ) {
                Text(if (isSubmitting) "Ekleniyor…" else "Ürün ekle")
            }
        }
    }
}
