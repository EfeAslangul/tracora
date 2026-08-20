package com.tracora.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.Surface
import androidx.compose.ui.Modifier
import com.tracora.android.ui.nav.TracoraNavHost
import com.tracora.android.ui.theme.TracoraTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            TracoraTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    TracoraNavHost()
                }
            }
        }
    }
}
