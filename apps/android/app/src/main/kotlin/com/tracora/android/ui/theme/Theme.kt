package com.tracora.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Loosely matches apps/web/src/styles.css's palette (primary #216869, error #9c2f2f).
private val TracoraPrimary = Color(0xFF216869)
private val TracoraError = Color(0xFF9C2F2F)

private val LightColors = lightColorScheme(
    primary = TracoraPrimary,
    error = TracoraError,
)

private val DarkColors = darkColorScheme(
    primary = TracoraPrimary,
    error = TracoraError,
)

@Composable
fun TracoraTheme(content: @Composable () -> Unit) {
    val colors = if (isSystemInDarkTheme()) DarkColors else LightColors
    MaterialTheme(colorScheme = colors, content = content)
}
