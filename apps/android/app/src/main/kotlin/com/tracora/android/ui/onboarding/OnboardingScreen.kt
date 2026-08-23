package com.tracora.android.ui.onboarding

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextField
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tracora.android.di.ViewModelFactory
import com.tracora.android.ui.theme.PlexMonoFontFamily
import com.tracora.android.ui.theme.SoraFontFamily
import com.tracora.android.ui.theme.TracoraColors

@Composable
fun OnboardingScreen(
    onCompleted: () -> Unit,
    viewModel: OnboardingViewModel = viewModel(factory = ViewModelFactory()),
) {
    val state by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(TracoraColors.Background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 20.dp)
            .padding(top = 66.dp, bottom = 40.dp),
    ) {
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
            Text("ADIM 1 / 1", color = TracoraColors.SecondaryText, fontFamily = PlexMonoFontFamily, fontSize = 11.sp)
            Text("${state.validCount} / 20 BAĞLANTI", color = TracoraColors.SecondaryText, fontFamily = PlexMonoFontFamily, fontSize = 11.sp)
        }

        Text(
            "Bağlantıları yapıştır",
            color = TracoraColors.Ink,
            fontFamily = SoraFontFamily,
            fontWeight = FontWeight.Bold,
            fontSize = 28.sp,
            modifier = Modifier.padding(top = 22.dp),
        )
        Text(
            "Her satıra bir ürün. En az bir tanesi çalıştığında kurulum tamamlanır.",
            color = TracoraColors.SecondaryText,
            fontFamily = SoraFontFamily,
            fontSize = 13.sp,
            modifier = Modifier.padding(top = 8.dp),
        )

        Column(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 20.dp)) {
            state.urls.forEachIndexed { index, url ->
                OnboardingRow(
                    index = index,
                    url = url,
                    onChange = { viewModel.updateUrl(index, it) },
                    onRemove = if (state.urls.size > 1) { { viewModel.removeRow(index) } } else null,
                )
            }
            if (state.canAddMore) {
                Text(
                    "+ Bağlantı ekle",
                    color = TracoraColors.Accent,
                    fontFamily = SoraFontFamily,
                    fontWeight = FontWeight.SemiBold,
                    fontSize = 14.sp,
                    modifier = Modifier
                        .padding(vertical = 12.dp)
                        .clickable { viewModel.addRow() },
                )
            }
        }

        state.errorMessage?.let {
            Text(it, color = TracoraColors.Danger, fontFamily = SoraFontFamily, fontSize = 13.sp, modifier = Modifier.padding(top = 8.dp))
        }

        Text(
            "İLK KONTROL: HEMEN · SONRAKİLER: 24 SAAT",
            color = TracoraColors.TertiaryText,
            fontFamily = PlexMonoFontFamily,
            fontSize = 11.sp,
            modifier = Modifier.padding(top = 26.dp),
        )

        Button(
            onClick = { viewModel.submit(onCompleted) },
            enabled = !state.isSubmitting && state.validCount > 0,
            colors = ButtonDefaults.buttonColors(containerColor = TracoraColors.Accent, contentColor = Color.White),
            shape = RoundedCornerShape(12.dp),
            contentPadding = PaddingValues(vertical = 16.dp),
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        ) {
            Text(if (state.isSubmitting) "BAŞLATILIYOR…" else "TAKİBİ BAŞLAT", fontFamily = SoraFontFamily, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun OnboardingRow(index: Int, url: String, onChange: (String) -> Unit, onRemove: (() -> Unit)?) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .background(TracoraColors.Surface, RoundedCornerShape(10.dp))
            .padding(horizontal = 14.dp, vertical = 6.dp),
    ) {
        TextField(
            value = url,
            onValueChange = onChange,
            placeholder = { Text("https://…", fontFamily = PlexMonoFontFamily, fontSize = 12.sp, color = TracoraColors.TertiaryText) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
            textStyle = androidx.compose.ui.text.TextStyle(fontFamily = PlexMonoFontFamily, fontSize = 12.sp, color = TracoraColors.Ink),
            colors = TextFieldDefaults.colors(
                focusedContainerColor = Color.Transparent,
                unfocusedContainerColor = Color.Transparent,
                focusedIndicatorColor = Color.Transparent,
                unfocusedIndicatorColor = Color.Transparent,
            ),
            modifier = Modifier.weight(1f),
        )
        if (onRemove != null) {
            Text(
                "✕",
                color = TracoraColors.TertiaryText,
                fontFamily = FontFamily.Monospace,
                modifier = Modifier.clickable(onClick = onRemove).padding(8.dp),
            )
        }
    }
}
