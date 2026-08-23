package com.tracora.android.ui.products

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FloatingActionButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tracora.android.data.model.ProductListItem
import com.tracora.android.data.model.ProductStatus
import com.tracora.android.di.ViewModelFactory
import com.tracora.android.ui.theme.PlexMonoFontFamily
import com.tracora.android.ui.theme.SoraFontFamily
import com.tracora.android.ui.theme.TracoraColors

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProductListScreen(
    onProductClick: (String) -> Unit,
    onSettingsClick: () -> Unit = {},
    viewModel: ProductListViewModel = viewModel(factory = ViewModelFactory()),
) {
    val state by viewModel.uiState.collectAsState()
    var showAddSheet by remember { mutableStateOf(false) }
    var selectedGroup by remember { mutableStateOf<String?>(null) }

    val groups = remember(state.products) { state.products.map { it.hostname }.distinct().sorted() }
    val underTargetCount = remember(state.products) {
        state.products.count { it.currentPrice != null && it.targetPrice != null && it.currentPrice <= it.targetPrice }
    }
    val visible = remember(state.products, selectedGroup) {
        selectedGroup?.let { group -> state.products.filter { it.hostname == group } } ?: state.products
    }

    Scaffold(
        containerColor = TracoraColors.Background,
        floatingActionButton = {
            FloatingActionButton(onClick = { showAddSheet = true }, containerColor = TracoraColors.Accent, contentColor = Color.White) {
                Icon(Icons.Filled.Add, contentDescription = "Ürün ekle")
            }
        },
    ) { padding ->
        PullToRefreshBox(
            isRefreshing = state.isRefreshing,
            onRefresh = { viewModel.refreshManually() },
            modifier = Modifier.fillMaxSize().padding(padding),
        ) {
        when {
            state.isLoading -> Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                CircularProgressIndicator(color = TracoraColors.Accent)
            }

            state.errorMessage != null -> Text(
                text = state.errorMessage!!,
                color = TracoraColors.Danger,
                fontFamily = SoraFontFamily,
                modifier = Modifier.fillMaxSize().padding(24.dp),
            )

            state.products.isEmpty() -> Text(
                text = "Henüz izlenen ürün yok.",
                color = TracoraColors.SecondaryText,
                fontFamily = SoraFontFamily,
                modifier = Modifier.fillMaxSize().padding(24.dp),
            )

            else -> LazyColumn(
                modifier = Modifier.fillMaxSize(),
                contentPadding = PaddingValues(16.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp),
            ) {
                item {
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
                        Text("Takip", color = TracoraColors.Ink, fontFamily = SoraFontFamily, fontWeight = FontWeight.Bold, fontSize = 30.sp)
                        IconButton(onClick = onSettingsClick) {
                            Icon(Icons.Filled.Settings, contentDescription = "Ayarlar", tint = TracoraColors.SecondaryText)
                        }
                    }
                }

                if (underTargetCount > 0) {
                    item { HeroCard(underTargetCount) }
                }

                if (groups.isNotEmpty()) {
                    item {
                        Row(
                            modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
                            horizontalArrangement = Arrangement.spacedBy(7.dp),
                        ) {
                            GroupChip(label = "TÜM GRUPLAR", selected = selectedGroup == null) { selectedGroup = null }
                            groups.forEach { group ->
                                GroupChip(label = group.uppercase(), selected = selectedGroup == group) { selectedGroup = group }
                            }
                        }
                    }
                }

                val grouped = visible.groupBy { it.hostname }
                grouped.toSortedMap().forEach { (hostname, products) ->
                    item {
                        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            Text(
                                hostname.uppercase(),
                                color = TracoraColors.Accent,
                                fontFamily = PlexMonoFontFamily,
                                fontSize = 10.5.sp,
                                fontWeight = FontWeight.Bold,
                            )
                            Text("· ${products.size}", color = TracoraColors.SecondaryText, fontFamily = PlexMonoFontFamily, fontSize = 10.5.sp)
                        }
                    }
                    items(products, key = { it.id }) { product ->
                        ProductCard(
                            product = product,
                            isRetrying = product.id in state.retryingIds,
                            checkIntervalSeconds = state.checkIntervalSeconds,
                            onClick = { onProductClick(product.id) },
                            onRetry = { viewModel.retryProduct(product.id) },
                        )
                    }
                }
            }
        }
        }
    }

    if (showAddSheet) {
        AddProductSheet(
            isSubmitting = state.isSubmitting,
            errorMessage = state.addProductError,
            groups = groups,
            onDismiss = { showAddSheet = false },
            onSubmit = { url, targetPrice, notificationsEnabled ->
                viewModel.addProduct(url, targetPrice, notificationsEnabled)
            },
        )
    }
}

@Composable
private fun HeroCard(underTargetCount: Int) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(Brush.linearGradient(listOf(TracoraColors.GradientStart, TracoraColors.GradientEnd)), RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        Text("$underTargetCount", color = TracoraColors.Accent, fontFamily = PlexMonoFontFamily, fontWeight = FontWeight.Bold, fontSize = 32.sp)
        Column {
            Text("ürün hedef fiyatın altında", color = TracoraColors.Ink, fontFamily = SoraFontFamily, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
            Text("Bugünkü fırsatları incele", color = TracoraColors.SecondaryText, fontFamily = SoraFontFamily, fontSize = 12.sp)
        }
    }
}

@Composable
private fun GroupChip(label: String, selected: Boolean, onClick: () -> Unit) {
    Text(
        label,
        color = if (selected) Color.White else TracoraColors.SecondaryText,
        fontFamily = PlexMonoFontFamily,
        fontWeight = FontWeight.Bold,
        fontSize = 10.5.sp,
        modifier = Modifier
            .background(if (selected) TracoraColors.Accent else TracoraColors.Surface, RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .padding(horizontal = 11.dp, vertical = 7.dp),
    )
}

@Composable
private fun ProductCard(
    product: ProductListItem,
    isRetrying: Boolean,
    checkIntervalSeconds: Int,
    onClick: () -> Unit,
    onRetry: () -> Unit,
) {
    val changePercent = if (product.currentPrice != null && product.previousPrice != null && product.previousPrice != 0.0) {
        ((product.currentPrice - product.previousPrice) / product.previousPrice) * 100
    } else null

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(TracoraColors.Surface, RoundedCornerShape(16.dp))
            .clickable(onClick = onClick)
            .padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Box(
            modifier = Modifier.size(width = 72.dp, height = 80.dp).background(TracoraColors.ImagePlaceholder, RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.BottomCenter,
        ) {
            Text("GÖRSEL", color = TracoraColors.TertiaryText, fontFamily = PlexMonoFontFamily, fontSize = 8.5.sp, modifier = Modifier.padding(bottom = 7.dp))
        }

        Column(modifier = Modifier.weight(1f)) {
            Row(horizontalArrangement = Arrangement.SpaceBetween, modifier = Modifier.fillMaxWidth()) {
                Text(
                    product.name ?: product.hostname,
                    color = TracoraColors.Ink,
                    fontFamily = SoraFontFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.weight(1f),
                )
                if (product.status == ProductStatus.FAILED) {
                    Text(
                        "FAILED",
                        color = TracoraColors.Warning,
                        fontFamily = PlexMonoFontFamily,
                        fontSize = 10.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.background(TracoraColors.WarningBackground, RoundedCornerShape(6.dp)).padding(horizontal = 7.dp, vertical = 3.dp),
                    )
                } else if (changePercent != null) {
                    Text(
                        String.format("%s%.0f%%", if (changePercent <= 0) "−" else "+", kotlin.math.abs(changePercent)),
                        color = Color.White,
                        fontFamily = PlexMonoFontFamily,
                        fontSize = 12.sp,
                        fontWeight = FontWeight.Bold,
                        modifier = Modifier.background(TracoraColors.Accent, RoundedCornerShape(6.dp)).padding(horizontal = 7.dp, vertical = 3.dp),
                    )
                }
            }

            Text(product.hostname.uppercase(), color = TracoraColors.TertiaryText, fontFamily = PlexMonoFontFamily, fontSize = 10.5.sp, modifier = Modifier.padding(top = 4.dp))

            if (product.status == ProductStatus.FAILED) {
                Text(
                    product.lastError?.message ?: "Fiyat okunamadı.",
                    color = TracoraColors.Warning,
                    fontFamily = SoraFontFamily,
                    fontSize = 11.5.sp,
                    modifier = Modifier.padding(top = 8.dp),
                )
                Text(
                    if (isRetrying) "Yeniden deneniyor…" else "Yeniden dene",
                    color = TracoraColors.Accent,
                    fontFamily = SoraFontFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 11.5.sp,
                    modifier = Modifier.padding(top = 6.dp).clickable(enabled = !isRetrying, onClick = onRetry),
                )
            } else {
                Row(verticalAlignment = Alignment.Bottom, modifier = Modifier.padding(top = 10.dp)) {
                    Text(
                        product.currentPrice?.let { "${it.toInt()}₺" } ?: "—₺",
                        color = TracoraColors.Ink,
                        fontFamily = PlexMonoFontFamily,
                        fontWeight = FontWeight.Bold,
                        fontSize = 24.sp,
                    )
                    product.previousPrice?.let {
                        Text(
                            "${it.toInt()}₺",
                            color = TracoraColors.TertiaryText,
                            fontFamily = PlexMonoFontFamily,
                            fontSize = 12.sp,
                            modifier = Modifier.padding(start = 9.dp, bottom = 2.dp),
                            textDecoration = androidx.compose.ui.text.style.TextDecoration.LineThrough,
                        )
                    }
                }
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp), modifier = Modifier.padding(top = 9.dp)) {
                    // inStock üç durumludur; nil "bilinmiyor" demektir, "stokta" değil.
                    val stockColor = when (product.inStock) {
                        true -> TracoraColors.Success
                        false -> TracoraColors.Danger
                        null -> TracoraColors.SecondaryText
                    }
                    val stockLabel = when (product.inStock) {
                        true -> "Stokta"
                        false -> "Tükendi"
                        null -> "Bilinmiyor"
                    }
                    Box(modifier = Modifier.size(6.dp).background(stockColor, shape = androidx.compose.foundation.shape.CircleShape))
                    Text(stockLabel, color = TracoraColors.SecondaryText, fontFamily = SoraFontFamily, fontSize = 11.sp)
                    Text(
                        product.targetPrice?.let { "Hedef ${it.toInt()}₺" } ?: "Hedef yok",
                        color = TracoraColors.SecondaryText,
                        fontFamily = SoraFontFamily,
                        fontSize = 11.sp,
                    )
                }
                nextCheckText(product.lastCheckedAt, checkIntervalSeconds)?.let { text ->
                    Text(text, color = TracoraColors.TertiaryText, fontFamily = SoraFontFamily, fontSize = 10.5.sp, modifier = Modifier.padding(top = 4.dp))
                }
            }
        }
    }
}

/** FAILED ürünlerde çağrılmaz: elle "Yeniden dene"nmeden otomatik tekrar denenmez. */
private fun nextCheckText(lastCheckedAt: String?, intervalSeconds: Int): String? {
    val checked = lastCheckedAt?.let { runCatching { java.time.Instant.parse(it) }.getOrNull() } ?: return null
    val remaining = java.time.Duration.between(java.time.Instant.now(), checked.plusSeconds(intervalSeconds.toLong()))
    val seconds = remaining.seconds
    if (seconds <= 60) return "Sonraki kontrol birazdan"
    val hours = seconds / 3_600
    if (hours >= 1) return "Sonraki kontrol ~$hours sa sonra"
    val minutes = (seconds / 60).coerceAtLeast(1)
    return "Sonraki kontrol ~$minutes dk sonra"
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun AddProductSheet(
    isSubmitting: Boolean,
    errorMessage: String?,
    groups: List<String>,
    onDismiss: () -> Unit,
    onSubmit: (url: String, targetPrice: Double?, notificationsEnabled: Boolean) -> Unit,
) {
    var url by remember { mutableStateOf("") }
    var targetPrice by remember { mutableStateOf("") }
    var notificationsEnabled by remember { mutableStateOf(true) }
    var selectedGroup by remember { mutableStateOf<String?>(null) }

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(),
        containerColor = TracoraColors.Background,
    ) {
        Column(modifier = Modifier.fillMaxWidth().padding(24.dp)) {
            Text("Yeni ürün", color = TracoraColors.Ink, fontFamily = SoraFontFamily, fontWeight = FontWeight.Bold, fontSize = 22.sp)
            OutlinedTextField(
                value = url,
                onValueChange = { url = it },
                label = { Text("Ürün bağlantısı") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
                colors = sheetFieldColors(),
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
            )
            OutlinedTextField(
                value = targetPrice,
                onValueChange = { targetPrice = it },
                label = { Text("Hedef fiyat") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                colors = sheetFieldColors(),
                modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            )

            if (groups.isNotEmpty()) {
                Row(
                    modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(top = 14.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    groups.forEach { group ->
                        GroupChip(label = group, selected = selectedGroup == group) {
                            selectedGroup = if (selectedGroup == group) null else group
                        }
                    }
                }
            }

            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 16.dp)) {
                Text("Bildirim açık", color = TracoraColors.SecondaryText, fontFamily = SoraFontFamily, fontSize = 13.sp, modifier = Modifier.weight(1f))
                Switch(
                    checked = notificationsEnabled,
                    onCheckedChange = { notificationsEnabled = it },
                    colors = SwitchDefaults.colors(checkedThumbColor = Color.White, checkedTrackColor = TracoraColors.Accent),
                )
            }
            errorMessage?.let {
                Text(it, color = TracoraColors.Danger, fontFamily = SoraFontFamily, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
            }
            Button(
                enabled = !isSubmitting && url.isNotBlank(),
                onClick = { onSubmit(url, targetPrice.toDoubleOrNull(), notificationsEnabled) },
                colors = ButtonDefaults.buttonColors(containerColor = TracoraColors.Accent, contentColor = Color.White),
                shape = RoundedCornerShape(12.dp),
                modifier = Modifier.fillMaxWidth().padding(top = 16.dp),
                contentPadding = PaddingValues(vertical = 16.dp),
            ) {
                Text(if (isSubmitting) "EKLENİYOR…" else "ÜRÜN EKLE", fontFamily = SoraFontFamily, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun sheetFieldColors() = TextFieldDefaults.colors(
    focusedContainerColor = TracoraColors.Surface,
    unfocusedContainerColor = TracoraColors.Surface,
    focusedIndicatorColor = TracoraColors.Accent,
    unfocusedIndicatorColor = TracoraColors.Border,
    focusedTextColor = TracoraColors.Ink,
    unfocusedTextColor = TracoraColors.Ink,
    focusedLabelColor = TracoraColors.SecondaryText,
    unfocusedLabelColor = TracoraColors.SecondaryText,
)
