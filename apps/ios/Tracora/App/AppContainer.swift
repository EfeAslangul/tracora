import Foundation

/// Lightweight DI container — mirrors `apps/android/.../di/AppContainer.kt`'s hand-rolled service
/// locator. The app is small enough that a DI framework would add build cost without buying much.
@MainActor
final class AppContainer: ObservableObject {
    let authService: FirebaseAuthService
    let productRepository: ProductRepository

    init() {
        let authService = FirebaseAuthService()
        self.authService = authService
        let api = ApiClient(
            baseURL: Config.apiBaseURL,
            tokenProvider: { await authService.currentIdToken() },
            onUnauthenticated: { @MainActor in authService.signOut() }
        )
        self.productRepository = ProductRepository(api: api)
    }
}
