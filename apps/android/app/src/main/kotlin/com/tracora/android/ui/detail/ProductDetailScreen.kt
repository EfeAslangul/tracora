package com.tracora.android.ui.detail

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextDecoration
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tracora.android.data.model.PriceHistoryPoint
import com.tracora.android.data.model.ProductDetail
import com.tracora.android.data.model.ProductStatus
import com.tracora.android.di.ViewModelFactory
import com.tracora.android.ui.theme.PlexMonoFontFamily
import com.tracora.android.ui.theme.SoraFontFamily
import com.tracora.android.ui.theme.TracoraColors

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

    Box(modifier = Modifier.fillMaxSize().background(TracoraColors.Background)) {
        val product = state.product
        when {
            state.isLoading && product == null -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = TracoraColors.Accent)
            }

            state.loadError != null && product == null -> Text(
                text = state.loadError!!,
                color = TracoraColors.Danger,
                fontFamily = SoraFontFamily,
                modifier = Modifier.fillMaxSize().padding(24.dp),
            )

            product != null -> ProductDetailContent(
                product = product,
                state = state,
                onBack = onBack,
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
                }) { Text("Sil", color = TracoraColors.Danger) }
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
    onBack: () -> Unit,
    onCheck: () -> Unit,
    onRetry: () -> Unit,
    onToggleStatus: () -> Unit,
    onDeleteClick: () -> Unit,
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(18.dp)
            .padding(top = 40.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("‹ Ürünler", color = TracoraColors.Accent, fontFamily = SoraFontFamily, fontWeight = FontWeight.SemiBold, fontSize = 13.sp, modifier = Modifier.clickable(onClick = onBack))
            Text(
                if (product.status == ProductStatus.PAUSED) "Aktif et" else "Duraklat",
                color = TracoraColors.SecondaryText,
                fontFamily = SoraFontFamily,
                fontSize = 13.sp,
                modifier = Modifier.clickable(onClick = onToggleStatus),
            )
        }

        Row(modifier = Modifier.padding(top = 18.dp), horizontalArrangement = Arrangement.spacedBy(14.dp)) {
            Box(modifier = Modifier.size(width = 96.dp, height = 108.dp).background(TracoraColors.ImagePlaceholder, RoundedCornerShape(14.dp)))
            Column(modifier = Modifier.weight(1f)) {
                Text(product.name ?: product.hostname, color = TracoraColors.Ink, fontFamily = SoraFontFamily, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                Text(product.hostname.uppercase(), color = TracoraColors.TertiaryText, fontFamily = PlexMonoFontFamily, fontSize = 10.5.sp, modifier = Modifier.padding(top = 6.dp))
                Text(
                    formatPrice(product.currentPrice, product.currency),
                    color = TracoraColors.Ink,
                    fontFamily = PlexMonoFontFamily,
                    fontWeight = FontWeight.Bold,
                    fontSize = 32.sp,
                    modifier = Modifier.padding(top = 10.dp),
                )
            }
        }

        product.targetPrice?.let { target ->
            DistanceToTargetCard(
                currentPrice = product.currentPrice,
                targetPrice = target,
                startPrice = product.priceHistory.firstOrNull()?.price,
                currency = product.currency,
            )
        }

        PriceHistoryChart(priceHistory = product.priceHistory, targetPrice = product.targetPrice)

        if (product.recentEvents.isNotEmpty()) {
            Text("OLAYLAR", color = TracoraColors.TertiaryText, fontFamily = PlexMonoFontFamily, fontWeight = FontWeight.Bold, fontSize = 11.sp, modifier = Modifier.padding(top = 20.dp, bottom = 8.dp))
            product.recentEvents.forEach { event ->
                Row(modifier = Modifier.padding(vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Box(modifier = Modifier.padding(top = 6.dp).size(6.dp).background(if (event.code == null) TracoraColors.Success else TracoraColors.TertiaryText, CircleShape))
                    Column {
                        Text(event.message, color = TracoraColors.Ink, fontFamily = SoraFontFamily, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp)
                        Text(event.createdAt, color = TracoraColors.TertiaryText, fontFamily = SoraFontFamily, fontSize = 11.5.sp, modifier = Modifier.padding(top = 2.dp))
                    }
                }
            }
        }

        state.actionError?.let {
            Text(it, color = TracoraColors.Danger, fontFamily = SoraFontFamily, fontSize = 13.sp, modifier = Modifier.padding(top = 12.dp))
        }

        Row(modifier = Modifier.padding(top = 18.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
            Button(
                onClick = onCheck,
                enabled = !state.isChecking && product.status != ProductStatus.PAUSED,
                colors = ButtonDefaults.buttonColors(containerColor = TracoraColors.Accent, contentColor = Color.White),
                shape = RoundedCornerShape(12.dp),
                contentPadding = PaddingValues(vertical = 15.dp),
                modifier = Modifier.weight(1f),
            ) {
                Text(if (state.isChecking) "KONTROL EDİLİYOR…" else "ŞİMDİ KONTROL ET", fontFamily = SoraFontFamily, fontWeight = FontWeight.Bold, fontSize = 13.sp)
            }
            if (product.status == ProductStatus.FAILED) {
                OutlinedButton(
                    onClick = onRetry,
                    enabled = !state.isRetrying,
                    shape = RoundedCornerShape(12.dp),
                    contentPadding = PaddingValues(vertical = 15.dp),
                ) {
                    Text(if (state.isRetrying) "DENENİYOR…" else "YENİDEN DENE", color = TracoraColors.Ink, fontFamily = SoraFontFamily, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                }
            }
        }

        OutlinedButton(
            onClick = onDeleteClick,
            enabled = !state.isDeleting,
            shape = RoundedCornerShape(12.dp),
            contentPadding = PaddingValues(vertical = 15.dp),
            modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
        ) {
            Text("SİL", color = TracoraColors.Danger, fontFamily = SoraFontFamily, fontWeight = FontWeight.Bold, fontSize = 13.sp)
        }
    }
}

@Composable
private fun DistanceToTargetCard(currentPrice: Double?, targetPrice: Double, startPrice: Double?, currency: String?) {
    val progress = if (currentPrice != null && startPrice != null && startPrice != targetPrice) {
        ((startPrice - currentPrice) / (startPrice - targetPrice)).coerceIn(0.0, 1.0)
    } else 0.0
    val remaining = currentPrice?.let { (it - targetPrice).coerceAtLeast(0.0) } ?: 0.0

    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 14.dp)
            .background(TracoraColors.Surface, RoundedCornerShape(16.dp))
            .padding(16.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Hedefe kalan", color = TracoraColors.SecondaryText, fontFamily = SoraFontFamily, fontWeight = FontWeight.SemiBold, fontSize = 12.5.sp)
            Text(formatPrice(remaining, currency), color = TracoraColors.Accent, fontFamily = PlexMonoFontFamily, fontWeight = FontWeight.Bold, fontSize = 12.5.sp)
        }
        Box(modifier = Modifier.fillMaxWidth().height(8.dp).padding(top = 10.dp).background(TracoraColors.Border, RoundedCornerShape(50))) {
            Box(modifier = Modifier.fillMaxWidth(progress.toFloat().coerceIn(0f, 1f)).height(8.dp).background(TracoraColors.Accent, RoundedCornerShape(50)))
        }
        Row(modifier = Modifier.fillMaxWidth().padding(top = 7.dp), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("Hedef ${formatPrice(targetPrice, currency)}", color = TracoraColors.TertiaryText, fontFamily = PlexMonoFontFamily, fontSize = 10.5.sp)
            startPrice?.let {
                Text("Başlangıç ${formatPrice(it, currency)}", color = TracoraColors.TertiaryText, fontFamily = PlexMonoFontFamily, fontSize = 10.5.sp)
            }
        }
    }
}

@Composable
private fun PriceHistoryChart(priceHistory: List<PriceHistoryPoint>, targetPrice: Double?) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .padding(top = 12.dp)
            .background(TracoraColors.Surface, RoundedCornerShape(16.dp))
            .padding(16.dp),
    ) {
        Text("FİYAT GEÇMİŞİ", color = TracoraColors.TertiaryText, fontFamily = PlexMonoFontFamily, fontWeight = FontWeight.Bold, fontSize = 11.sp)

        if (priceHistory.isEmpty()) {
            Text("Henüz fiyat geçmişi yok.", color = TracoraColors.TertiaryText, fontFamily = SoraFontFamily, fontSize = 13.sp, modifier = Modifier.padding(top = 12.dp))
            return@Column
        }

        val prices = priceHistory.map { it.price }
        val minPrice = (prices + listOfNotNull(targetPrice)).min()
        val maxPrice = (prices + listOfNotNull(targetPrice)).max()
        val range = (maxPrice - minPrice).takeIf { it > 0 } ?: 1.0

        androidx.compose.foundation.Canvas(modifier = Modifier.fillMaxWidth().height(150.dp).padding(top = 12.dp)) {
            val stepX = if (prices.size > 1) size.width / (prices.size - 1) else size.width
            fun yFor(price: Double) = (size.height * (1 - (price - minPrice) / range)).toFloat()

            val path = Path()
            prices.forEachIndexed { index, price ->
                val point = androidx.compose.ui.geometry.Offset(index * stepX, yFor(price))
                if (index == 0) path.moveTo(point.x, point.y) else path.lineTo(point.x, point.y)
            }
            drawPath(path, color = TracoraColors.Accent, style = Stroke(width = 3f))

            targetPrice?.let {
                val y = yFor(it)
                drawLine(
                    color = TracoraColors.Danger,
                    start = androidx.compose.ui.geometry.Offset(0f, y),
                    end = androidx.compose.ui.geometry.Offset(size.width, y),
                    strokeWidth = 2f,
                    pathEffect = PathEffect.dashPathEffect(floatArrayOf(10f, 10f)),
                )
            }
        }
    }
}

private fun formatPrice(value: Double?, currency: String?): String {
    if (value == null) return "—₺"
    val symbol = if (currency == "TRY" || currency == null) "₺" else currency
    return "${value.toInt()}$symbol"
}
