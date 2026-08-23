package com.tracora.android.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

// Direction 1b ("energetic iris") is dark-only per the imported mock — no light variant exists,
// so unlike a typical Material app this doesn't branch on `isSystemInDarkTheme()`.
private val TracoraDarkColors = darkColorScheme(
    primary = TracoraColors.Accent,
    onPrimary = TracoraColors.AccentOnFill,
    background = TracoraColors.Background,
    onBackground = TracoraColors.Ink,
    surface = TracoraColors.Surface,
    onSurface = TracoraColors.Ink,
    surfaceVariant = TracoraColors.SurfaceElevated,
    onSurfaceVariant = TracoraColors.SecondaryText,
    outline = TracoraColors.Border,
    error = TracoraColors.Danger,
    onError = TracoraColors.AccentOnFill,
)

@Composable
fun TracoraTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = TracoraDarkColors, typography = TracoraTypography, content = content)
}
