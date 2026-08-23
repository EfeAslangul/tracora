import Foundation

@MainActor
final class ProductListViewModel: ObservableObject {
    @Published var products: [ProductListItem] = []
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var selectedGroup: String? // nil = "All groups"
    @Published var retryingIds: Set<String> = []
    @Published var checkIntervalSeconds = 86_400

    private let repository: ProductRepository
    private var pollTask: Task<Void, Never>?

    init(repository: ProductRepository) {
        self.repository = repository
    }

    /// Mirrors the web's refetchInterval logic (and Android's `startPolling`): while
    /// any product is still awaiting its baseline check, poll aggressively so a newly
    /// added product's price/stock appears without the user force-quitting the app.
    func startPolling() {
        guard pollTask == nil else { return }
        pollTask = Task { [weak self] in
            guard let self else { return }
            if let status = try? await self.repository.getSetupStatus() {
                self.checkIntervalSeconds = status.defaultCheckIntervalSeconds
            }
            while !Task.isCancelled {
                let awaitingBaseline = await self.load()
                try? await Task.sleep(nanoseconds: awaitingBaseline ? 3_000_000_000 : 60_000_000_000)
            }
        }
    }

    func stopPolling() {
        pollTask?.cancel()
        pollTask = nil
    }

    /// Groups are presentational-only for v1: no `group`/`tag` field exists on `Product` in the
    /// API contract, so chips are derived client-side from distinct hostnames.
    var groups: [String] {
        Array(Set(products.map(\.hostname))).sorted()
    }

    var visibleProducts: [ProductListItem] {
        guard let selectedGroup else { return products }
        return products.filter { $0.hostname == selectedGroup }
    }

    var groupedByHostname: [(hostname: String, items: [ProductListItem])] {
        let grouped = Dictionary(grouping: visibleProducts, by: \.hostname)
        return grouped.keys.sorted().map { ($0, grouped[$0] ?? []) }
    }

    var underTargetCount: Int {
        products.filter { item in
            guard let current = item.currentPrice, let target = item.targetPrice else { return false }
            return current <= target
        }.count
    }

    @discardableResult
    func load() async -> Bool {
        isLoading = true
        errorMessage = nil
        do {
            let response = try await repository.getProducts()
            products = response.items
            isLoading = false
            return response.items.contains { item in
                item.status == .pending || (item.status == .active && item.lastSuccessfulCheckAt == nil)
            }
        } catch let error as ApiException {
            errorMessage = error.message
        } catch {
            errorMessage = error.localizedDescription
        }
        isLoading = false
        return false
    }

    func retry(id: String) async {
        retryingIds.insert(id)
        do {
            let updated = try await repository.retryProduct(id: id)
            if let index = products.firstIndex(where: { $0.id == id }) {
                products[index] = updated
            }
        } catch {
            // Surface via the card itself in a future pass; keep v1 minimal.
        }
        retryingIds.remove(id)
    }
}
