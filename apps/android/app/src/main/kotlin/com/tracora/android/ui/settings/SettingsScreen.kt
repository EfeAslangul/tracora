package com.tracora.android.ui.settings

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tracora.android.di.ViewModelFactory
import com.tracora.android.ui.theme.SoraFontFamily
import com.tracora.android.ui.theme.TracoraColors

@Composable
fun SettingsScreen(
    onSignedOut: () -> Unit,
    viewModel: SettingsViewModel = viewModel(factory = ViewModelFactory()),
) {
    val state by viewModel.uiState.collectAsState()
    var showDeleteConfirm by remember { mutableStateOf(false) }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(TracoraColors.Background)
            .padding(20.dp)
            .padding(top = 50.dp),
    ) {
        Text("Ayarlar", color = TracoraColors.Ink, fontFamily = SoraFontFamily, fontWeight = FontWeight.Bold, fontSize = 28.sp)

        OutlinedButton(
            onClick = { viewModel.signOut(); onSignedOut() },
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth().padding(top = 24.dp),
            contentPadding = PaddingValues(vertical = 16.dp),
        ) {
            Text("Çıkış yap", color = TracoraColors.Ink, fontFamily = SoraFontFamily, fontWeight = FontWeight.SemiBold)
        }

        state.errorMessage?.let {
            Text(it, color = TracoraColors.Danger, fontFamily = SoraFontFamily, fontSize = 13.sp, modifier = Modifier.padding(top = 12.dp))
        }

        Button(
            onClick = { showDeleteConfirm = true },
            enabled = !state.isDeleting,
            colors = ButtonDefaults.buttonColors(containerColor = TracoraColors.DangerBackground, contentColor = TracoraColors.Danger),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
            contentPadding = PaddingValues(vertical = 16.dp),
        ) {
            Text(if (state.isDeleting) "Siliniyor…" else "Hesabı sil", fontFamily = SoraFontFamily, fontWeight = FontWeight.SemiBold)
        }
    }

    if (showDeleteConfirm) {
        AlertDialog(
            onDismissRequest = { showDeleteConfirm = false },
            title = { Text("Hesabı sil") },
            text = { Text("Bu işlem geri alınamaz. Tüm ürünleriniz ve hesabınız silinir.") },
            confirmButton = {
                TextButton(onClick = {
                    showDeleteConfirm = false
                    viewModel.deleteAccount(onSignedOut)
                }) { Text("Sil", color = TracoraColors.Danger) }
            },
            dismissButton = {
                TextButton(onClick = { showDeleteConfirm = false }) { Text("Vazgeç") }
            },
        )
    }
}
