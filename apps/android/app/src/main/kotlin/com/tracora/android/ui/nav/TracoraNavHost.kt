package com.tracora.android.ui.nav

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.tracora.android.di.AppContainer
import com.tracora.android.ui.auth.LoginScreen
import com.tracora.android.ui.detail.ProductDetailScreen
import com.tracora.android.ui.onboarding.OnboardingScreen
import com.tracora.android.ui.products.ProductListScreen
import com.tracora.android.ui.settings.SettingsScreen

private const val ROUTE_LOGIN = "login"
private const val ROUTE_ONBOARDING = "onboarding"
private const val ROUTE_PRODUCTS = "products"
private const val ROUTE_PRODUCT_DETAIL = "products/{id}"
private const val ROUTE_SETTINGS = "settings"

@Composable
fun TracoraNavHost() {
    val navController = rememberNavController()
    var isResolving by remember { mutableStateOf(true) }
    var startDestination by remember { mutableStateOf(ROUTE_LOGIN) }

    LaunchedEffect(Unit) {
        val authService = AppContainer.firebaseAuthService
        startDestination = if (authService.currentUser == null) {
            ROUTE_LOGIN
        } else {
            val required = runCatching { AppContainer.productRepository.getSetupStatus().required }.getOrDefault(false)
            if (required) ROUTE_ONBOARDING else ROUTE_PRODUCTS
        }
        isResolving = false
    }

    if (isResolving) {
        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator()
        }
        return
    }

    NavHost(navController = navController, startDestination = startDestination) {
        composable(ROUTE_LOGIN) {
            LoginScreen(onAuthenticated = {
                navController.navigate(ROUTE_PRODUCTS) {
                    popUpTo(ROUTE_LOGIN) { inclusive = true }
                }
            })
        }
        composable(ROUTE_ONBOARDING) {
            OnboardingScreen(onCompleted = {
                navController.navigate(ROUTE_PRODUCTS) {
                    popUpTo(ROUTE_ONBOARDING) { inclusive = true }
                }
            })
        }
        composable(ROUTE_PRODUCTS) {
            ProductListScreen(
                onProductClick = { id -> navController.navigate("products/$id") },
                onSettingsClick = { navController.navigate(ROUTE_SETTINGS) },
            )
        }
        composable(
            route = ROUTE_PRODUCT_DETAIL,
            arguments = listOf(navArgument("id") { type = NavType.StringType }),
        ) { backStackEntry ->
            val id = backStackEntry.arguments?.getString("id").orEmpty()
            ProductDetailScreen(productId = id, onBack = { navController.popBackStack() })
        }
        composable(ROUTE_SETTINGS) {
            SettingsScreen(onSignedOut = {
                navController.navigate(ROUTE_LOGIN) {
                    popUpTo(0) { inclusive = true }
                }
            })
        }
    }
}
