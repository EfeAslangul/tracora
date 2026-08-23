import Foundation

@MainActor
final class ProductDetailViewModel: ObservableObject {
    @Published var product: ProductDetail?
    @Published var isLoading = false
    @Published var loadError: String?
    @Published var isChecking = false
    @Published var isRetrying = false
    @Published var isTogglingStatus = false
    @Published var isDeleting = false
    @Published var actionError: String?
    @Published var deleted = false
    @Published var historyWindowDays: Int = 7

    private let repository: ProductRepository
    private let productId: String

    init(productId: String, repository: ProductRepository) {
        self.productId = productId
        self.repository = repository
    }

    func load() async {
        isLoading = true
        loadError = nil
        do {
            product = try await repository.getProduct(id: productId)
        } catch let error as ApiException {
            loadError = error.message
        } catch {
            loadError = error.localizedDescription
        }
        isLoading = false
    }

    func checkNow() async {
        isChecking = true
        actionError = nil
        do {
            _ = try await repository.checkProduct(id: productId)
        } catch let error as ApiException {
            actionError = error.message
        } catch {
            actionError = error.localizedDescription
        }
        isChecking = false
    }

    func retry() async {
        isRetrying = true
        actionError = nil
        do {
            _ = try await repository.retryProduct(id: productId)
            await load()
        } catch let error as ApiException {
            actionError = error.message
        } catch {
            actionError = error.localizedDescription
        }
        isRetrying = false
    }

    func toggleStatus() async {
        guard let product else { return }
        isTogglingStatus = true
        actionError = nil
        let newStatus: ProductStatus = product.status == .paused ? .active : .paused
        do {
            _ = try await repository.setStatus(id: productId, status: newStatus)
            await load()
        } catch let error as ApiException {
            actionError = error.message
        } catch {
            actionError = error.localizedDescription
        }
        isTogglingStatus = false
    }

    func delete() async {
        isDeleting = true
        actionError = nil
        do {
            try await repository.deleteProduct(id: productId)
            deleted = true
        } catch let error as ApiException {
            actionError = error.message
        } catch {
            actionError = error.localizedDescription
        }
        isDeleting = false
    }
}
