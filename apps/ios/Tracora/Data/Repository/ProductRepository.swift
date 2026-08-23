import Foundation

final class ProductRepository {
    private let api: ApiClient

    init(api: ApiClient) {
        self.api = api
    }

    func getProducts() async throws -> ProductListResponse {
        try await api.send(.getProducts())
    }

    func createProduct(url: String, targetPrice: Double?, notificationsEnabled: Bool) async throws -> ProductListItem {
        let body = CreateProductRequest(url: url, targetPrice: targetPrice, notificationsEnabled: notificationsEnabled)
        return try await api.send(.createProduct(), body: body)
    }

    func getProduct(id: String) async throws -> ProductDetail {
        try await api.send(.getProduct(id: id))
    }

    func setStatus(id: String, status: ProductStatus) async throws -> ProductListItem {
        let body = UpdateProductRequest(status: status)
        return try await api.send(.updateProduct(id: id), body: body)
    }

    func setTargetPrice(id: String, targetPrice: Double?) async throws -> ProductListItem {
        let body = UpdateProductRequest(targetPrice: .some(targetPrice))
        return try await api.send(.updateProduct(id: id), body: body)
    }

    func deleteProduct(id: String) async throws {
        try await api.sendNoContent(.deleteProduct(id: id), body: Optional<Empty>.none)
    }

    func checkProduct(id: String) async throws -> CheckAcceptedResponse {
        try await api.send(.checkProduct(id: id), body: Optional<Empty>.none)
    }

    func retryProduct(id: String) async throws -> ProductListItem {
        try await api.send(.retryProduct(id: id), body: Optional<Empty>.none)
    }

    func getSetupStatus() async throws -> SetupStatus {
        try await api.send(.getSetupStatus())
    }

    func postSetup(products: [SetupProductInput]) async throws -> SetupResult {
        try await api.send(.postSetup(), body: SetupRequest(products: products))
    }

    func deleteMe() async throws {
        try await api.sendNoContent(.deleteMe(), body: Optional<Empty>.none)
    }
}

private struct Empty: Encodable {}
