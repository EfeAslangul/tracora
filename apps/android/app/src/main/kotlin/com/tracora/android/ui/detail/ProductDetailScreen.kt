package com.tracora.android.ui.detail

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.patrykandpatrick.vico.compose.chart.Chart
import com.patrykandpatrick.vico.compose.chart.line.lineChart
import com.patrykandpatrick.vico.core.entry.ChartEntryModelProducer
import com.patrykandpatrick.vico.core.entry.entryOf
import com.tracora.android.data.model.ProductDetail
import com.tracora.android.data.model.ProductStatus
import com.tracora.android.di.ViewModelFactory

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductDetailScreen(
    productId: String,
    onBack: () -> Unit,
    viewModel: ProductDetailViewModel = viewModel(factory = ViewModelFactory()),
) {
    val state by viewModel.uiState.collectAsState()
    var showDeleteConfirm by remember { mutableStateOf(false) }

    LaunchedEffect(productId) { viewModel.load(productId) }
    LaunchedEffect(state.deleted) { if (state.deleted) onBack() }

    Scaffold(topBar = { TopAppBar(title = { Text("Ürün Detayı") }) }) { padding ->
        val product = state.product
        when {
            state.isLoading && product == null -> CircularProgressIndicator(
                modifier = Modifier.fillMaxSize().padding(padding).padding(32.dp),
            )

            state.loadError != null && product == null -> Text(
                text = state.loadError!!,
                modifier = Modifier.fillMaxSize().padding(padding).padding(24.dp),
            )

            product != null -> ProductDetailContent(
                product = product,
                state = state,
                modifier = Modifier.fillMaxSize().padding(padding).padding(16.dp),
                onCheck = viewModel::checkNow,
                onRetry = viewModel::retry,
                onToggleStatus = viewModel::toggleStatus,
                onDeleteClick = { showDeleteConfirm = true },
            )
        }
    }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Ürünü sil") },
            text = { Text("Bu ürünü silmek istediğinize emin misiniz?") },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteConfirm = false
                    viewModel.delete()
                }) { Text("Sil") }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) { Text("Vazgeç") }
            },
        )
    }
}

@Composable
private fun ProductDetailContent(
    product: ProductDetail,
    state: ProductDetailUiState,
    modifier: Modifier = Modifier,
    onCheck: () -> Unit,
    onRetry: () -> Unit,
    onToggleStatus: () -> Unit,
    onDeleteClick: () -> Unit,
) {
    Column(modifier = modifier) {
        Text(text = product.status.name)
        Text(text = product.name ?: product.hostname)
        Text(text = formatPrice(product.currentPrice, product.currency))

        val changePercent = if (product.currentPrice != null && product.previousPrice != null && product.previousPrice != 0.0) {
            ((product.currentPrice - product.previousPrice) / product.previousPrice) * 100
        } else {
            null
        }
        Text(text = "Değişim: " + (changePercent?.let { "%.1f%%".format(it) } ?: "—"))
        Text(text = "Hedef fiyat: " + formatPrice(product.targetPrice, product.currency))
        Text(text = "Stok: " + when (product.inStock) {
            null -> "Bilinmiyor"
            true -> "Var"
            false -> "Yok"
        })
        Text(text = "Son kontrol: " + (product.lastCheckedAt ?: "—"))
        product.lastError?.let { Text(text = it.message) }

        PriceHistoryChart(
            priceHistory = product.priceHistory,
            modifier = Modifier.fillMaxWidth().height(220.dp).padding(top = 16.dp),
        )

        Column(modifier = Modifier.padding(top = 16.dp)) {
            Button(onClick = onCheck, enabled = !state.isChecking && product.status != ProductStatus.PAUSED) {
                Text(if (state.isChecking) "Kontrol ediliyor…" else "Manuel kontrol")
            }
            if (product.status == ProductStatus.FAILED) {
                Button(onClick = onRetry, enabled = !state.isRetrying) {
                    Text(if (state.isRetrying) "Yeniden deneniyor…" else "Yeniden dene")
                }
            }
            Button(onClick = onToggleStatus, enabled = !state.isTogglingStatus) {
                Text(if (product.status == ProductStatus.PAUSED) "Aktif et" else "Duraklat")
            }
            Button(onClick = onDeleteClick, enabled = !state.isDeleting) { Text("Sil") }
        }

        state.actionError?.let { Text(text = it, modifier = Modifier.padding(top = 12.dp)) }
    }
}

@Composable
private fun PriceHistoryChart(priceHistory: List<com.tracora.android.data.model.PriceHistoryPoint>, modifier: Modifier = Modifier) {
    if (priceHistory.isEmpty()) {
        Text(text = "Henüz fiyat geçmişi yok.", modifier = modifier)
        return
    }
    // Vico's Compose API (verify against the version resolved in Android Studio — see app/build.gradle.kts).
    val producer = remember { ChartEntryModelProducer() }
    LaunchedEffect(priceHistory) {
        producer.setEntries(priceHistory.mapIndexed { index, point -> entryOf(index.toFloat(), point.price.toFloat()) })
    }
    Chart(
        chart = lineChart(),
        chartModelProducer = producer,
        modifier = modifier,
    )
}

private fun formatPrice(value: Double?, currency: String?): String {
    if (value == null) return "—"
    return "%.2f %s".format(value, currency ?: "")
}
