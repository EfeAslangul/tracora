package com.tracora.android.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextFieldDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.tracora.android.di.AppContainer
import com.tracora.android.di.ViewModelFactory
import com.tracora.android.ui.theme.SoraFontFamily
import com.tracora.android.ui.theme.TracoraColors

@Composable
fun LoginScreen(
    onAuthenticated: () -> Unit,
    viewModel: LoginViewModel = viewModel(factory = ViewModelFactory()),
) {
    val state by viewModel.uiState.collectAsState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(TracoraColors.Background)
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 26.dp)
            .padding(top = 70.dp, bottom = 40.dp),
    ) {
        Box(
            modifier = Modifier
                .size(44.dp)
                .background(TracoraColors.Accent, RoundedCornerShape(12.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Text("T", color = TracoraColors.Background, fontFamily = SoraFontFamily, fontWeight = FontWeight.Bold, fontSize = 22.sp)
        }

        Text(
            "TRACORA",
            color = TracoraColors.Ink,
            fontFamily = SoraFontFamily,
            fontWeight = FontWeight.Bold,
            fontSize = 20.sp,
            modifier = Modifier.padding(top = 12.dp),
        )

        Text(
            "Fiyat düştüğü anda haber ver.",
            color = TracoraColors.Ink,
            fontFamily = SoraFontFamily,
            fontWeight = FontWeight.Bold,
            fontSize = 34.sp,
            lineHeight = 38.sp,
            modifier = Modifier.padding(top = 56.dp),
        )

        Text(
            "Herkese açık ürün bağlantıları, günde bir kontrol, gruplanmış takip listesi.",
            color = TracoraColors.SecondaryText,
            fontFamily = SoraFontFamily,
            fontSize = 14.sp,
            modifier = Modifier.padding(top = 12.dp),
        )

        if (!viewModel.isConfigured) {
            Text(
                "Firebase henüz yapılandırılmadı. apps/android/README.md dosyasına bakın.",
                color = TracoraColors.Warning,
                fontFamily = SoraFontFamily,
                fontSize = 12.sp,
                modifier = Modifier
                    .padding(top = 18.dp)
                    .fillMaxWidth()
                    .background(TracoraColors.WarningBackground, RoundedCornerShape(12.dp))
                    .padding(12.dp),
            )
        }

        Column(verticalArrangement = Arrangement.spacedBy(12.dp), modifier = Modifier.padding(top = 36.dp)) {
            OutlinedTextField(
                value = state.email,
                onValueChange = viewModel::updateEmail,
                label = { Text("E-posta") },
                singleLine = true,
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Email),
                colors = fieldColors(),
                modifier = Modifier.fillMaxWidth(),
            )
            OutlinedTextField(
                value = state.password,
                onValueChange = viewModel::updatePassword,
                label = { Text("Şifre") },
                singleLine = true,
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                colors = fieldColors(),
                modifier = Modifier.fillMaxWidth(),
            )
        }

        state.errorMessage?.let {
            Text(it, color = TracoraColors.Danger, fontFamily = SoraFontFamily, fontSize = 13.sp, modifier = Modifier.padding(top = 10.dp))
        }

        Button(
            onClick = { viewModel.signIn(onAuthenticated) },
            enabled = !state.isSubmitting && viewModel.isConfigured,
            colors = ButtonDefaults.buttonColors(containerColor = TracoraColors.Accent, contentColor = Color.White),
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth().padding(top = 22.dp),
            contentPadding = PaddingValues(vertical = 16.dp),
        ) {
            Text(if (state.isSubmitting) "GİRİŞ YAPILIYOR…" else "GİRİŞ YAP", fontFamily = SoraFontFamily, fontWeight = FontWeight.Bold)
        }

        OutlinedButton(
            onClick = { viewModel.createAccount(onAuthenticated) },
            enabled = !state.isSubmitting && viewModel.isConfigured,
            shape = RoundedCornerShape(12.dp),
            modifier = Modifier.fillMaxWidth().padding(top = 10.dp),
            contentPadding = PaddingValues(vertical = 16.dp),
        ) {
            Text("KAYIT OLUŞTUR", color = TracoraColors.Ink, fontFamily = SoraFontFamily, fontWeight = FontWeight.Bold)
        }
    }
}

@Composable
private fun fieldColors() = TextFieldDefaults.colors(
    focusedContainerColor = TracoraColors.Surface,
    unfocusedContainerColor = TracoraColors.Surface,
    focusedIndicatorColor = TracoraColors.Accent,
    unfocusedIndicatorColor = TracoraColors.Border,
    focusedTextColor = TracoraColors.Ink,
    unfocusedTextColor = TracoraColors.Ink,
    focusedLabelColor = TracoraColors.SecondaryText,
    unfocusedLabelColor = TracoraColors.SecondaryText,
)
