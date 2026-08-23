import SwiftUI

struct ProductDetailView: View {
    @StateObject private var viewModel: ProductDetailViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var showDeleteConfirm = false

    init(productId: String, repository: ProductRepository) {
        _viewModel = StateObject(wrappedValue: ProductDetailViewModel(productId: productId, repository: repository))
    }

    var body: some View {
        ScrollView {
            if let product = viewModel.product {
                content(for: product)
            } else if viewModel.isLoading {
                ProgressView().tint(Palette.accent).padding(.top, 100)
            } else if let error = viewModel.loadError {
                Text(error).font(Typography.body(14)).foregroundStyle(Palette.danger).padding()
            }
        }
        .refreshable { await viewModel.load() }
        .background(Palette.background.ignoresSafeArea())
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.load() }
        .onChange(of: viewModel.deleted) { deleted in
            if deleted { dismiss() }
        }
        .alert("Ürünü sil", isPresented: $showDeleteConfirm) {
            Button("Sil", role: .destructive) { Task { await viewModel.delete() } }
            Button("Vazgeç", role: .cancel) {}
        } message: {
            Text("Bu ürünü silmek istediğinize emin misiniz?")
        }
    }

    @ViewBuilder
    private func content(for product: ProductDetail) -> some View {
        VStack(alignment: .leading, spacing: 18) {
            HStack(alignment: .top, spacing: 14) {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Palette.imagePlaceholder)
                    .frame(width: 104, height: 120)

                VStack(alignment: .leading, spacing: 6) {
                    Text(product.name ?? product.hostname)
                        .font(Typography.body(16, weight: .semibold))
                        .foregroundStyle(Palette.ink)
                    Text(product.hostname)
                        .font(Typography.body(11.5))
                        .foregroundStyle(Palette.tertiaryText)
                    Text(priceText(product.currentPrice, product.currency))
                        .font(Typography.price(38))
                        .foregroundStyle(Palette.ink)
                        .padding(.top, 4)
                }
            }

            if let target = product.targetPrice {
                DistanceToTargetCardView(
                    currentPrice: product.currentPrice,
                    targetPrice: target,
                    startPrice: product.priceHistory.first?.price,
                    currency: product.currency
                )
            }

            PriceHistoryChartView(points: product.priceHistory, targetPrice: product.targetPrice, windowDays: $viewModel.historyWindowDays)

            if !product.recentEvents.isEmpty {
                EventsTimelineView(events: product.recentEvents)
            }

            if let error = viewModel.actionError {
                Text(error).font(Typography.body(13)).foregroundStyle(Palette.danger)
            }

            HStack(spacing: 10) {
                PrimaryButton(title: "Şimdi kontrol et", isLoading: viewModel.isChecking, isDisabled: product.status == .paused) {
                    Task { await viewModel.checkNow() }
                }
                if product.status == .failed {
                    SecondaryButton(title: viewModel.isRetrying ? "Deneniyor…" : "Yeniden dene") {
                        Task { await viewModel.retry() }
                    }
                }
            }

            HStack(spacing: 10) {
                SecondaryButton(title: product.status == .paused ? "Aktif et" : "Duraklat") {
                    Task { await viewModel.toggleStatus() }
                }
                SecondaryButton(title: "Sil") { showDeleteConfirm = true }
            }
        }
        .padding(18)
    }
}
