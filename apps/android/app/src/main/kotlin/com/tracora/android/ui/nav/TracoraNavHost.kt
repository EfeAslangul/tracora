package com.tracora.android.ui.nav

import androidx.compose.runtime.Composable
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.tracora.android.ui.detail.ProductDetailScreen
import com.tracora.android.ui.products.ProductListScreen

private const val ROUTE_PRODUCTS = "products"
private const val ROUTE_PRODUCT_DETAIL = "products/{id}"

@Composable
fun TracoraNavHost() {
    val navController = rememberNavController()

    NavHost(navController = navController, startDestination = ROUTE_PRODUCTS) {
        composable(ROUTE_PRODUCTS) {
            ProductListScreen(onProductClick = { id -> navController.navigate("products/$id") })
        }
        composable(
            route = ROUTE_PRODUCT_DETAIL,
            arguments = listOf(navArgument("id") { type = NavType.StringType }),
        ) { backStackEntry ->
            val id = backStackEntry.arguments?.getString("id").orEmpty()
            ProductDetailScreen(productId = id, onBack = { navController.popBackStack() })
        }
    }
}
