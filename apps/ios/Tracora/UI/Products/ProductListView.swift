import SwiftUI

struct ProductListView: View {
    @EnvironmentObject var container: AppContainer
    @StateObject private var viewModel: ProductListViewModel
    @State private var showAddSheet = false
    @State private var didLoad = false

    init(repository: ProductRepository) {
        _viewModel = StateObject(wrappedValue: ProductListViewModel(repository: repository))
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header

                    if !viewModel.groups.isEmpty {
                        groupChips
                    }

                    if viewModel.isLoading && viewModel.products.isEmpty {
                        LoadingSkeletonView()
                    } else if let error = viewModel.errorMessage, viewModel.products.isEmpty {
                        Text(error)
                            .font(Typography.body(14))
                            .foregroundStyle(Palette.danger)
                    } else if viewModel.products.isEmpty {
                        EmptyStateView(onAddProduct: { showAddSheet = true })
                            .frame(minHeight: 400)
                    } else {
                        productSections
                    }
                }
                .padding(.horizontal, 18)
                .padding(.top, 12)
                .padding(.bottom, 100)
            }
            .refreshable { await viewModel.load() }
            .background(Palette.background.ignoresSafeArea())
            .navigationBarHidden(true)
            .overlay(alignment: .bottomTrailing) {
                Button(action: { showAddSheet = true }) {
                    Image(systemName: "plus")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(Palette.accentOnFill)
                        .frame(width: 56, height: 56)
                }
                .background(Palette.accent)
                .clipShape(Circle())
                .shadow(radius: 10, y: 4)
                .padding(20)
            }
            .sheet(isPresented: $showAddSheet) {
                AddProductSheetView(repository: container.productRepository, groups: viewModel.groups) {
                    Task { await viewModel.load() }
                }
            }
        }
        .task {
            guard !didLoad else { return }
            didLoad = true
            viewModel.startPolling()
        }
    }

    private var header: some View {
        HStack(alignment: .bottom) {
            VStack(alignment: .leading, spacing: 6) {
                Text("GÜNLÜK TAKİP")
                    .font(Typography.body(11.5, weight: .bold))
                    .foregroundStyle(Palette.accent)
                Text("Ürünler")
                    .font(Typography.serifHeadline(36))
                    .foregroundStyle(Palette.ink)
            }
            Spacer()
            VStack(alignment: .trailing, spacing: 8) {
                NavigationLink(destination: SettingsView()) {
                    Image(systemName: "gearshape")
                        .foregroundStyle(Palette.secondaryText)
                }
                PillBadge(text: "\(viewModel.products.count) ürün", foreground: Palette.secondaryText, background: Palette.pillBackground)
            }
        }
    }

    private var groupChips: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                GroupChip(title: "Tüm gruplar", isSelected: viewModel.selectedGroup == nil) {
                    viewModel.selectedGroup = nil
                }
                ForEach(viewModel.groups, id: \.self) { group in
                    GroupChip(title: group, isSelected: viewModel.selectedGroup == group) {
                        viewModel.selectedGroup = group
                    }
                }
            }
        }
    }

    private var productSections: some View {
        VStack(alignment: .leading, spacing: 18) {
            ForEach(viewModel.groupedByHostname, id: \.hostname) { section in
                VStack(alignment: .leading, spacing: 12) {
                    HStack(spacing: 10) {
                        Text(section.hostname.uppercased())
                            .font(Typography.body(11.5, weight: .bold))
                            .foregroundStyle(Palette.accent)
                        Text("\(section.items.count) ürün")
                            .font(Typography.body(11.5))
                            .foregroundStyle(Palette.tertiaryText)
                        Rectangle().fill(Palette.border).frame(height: 1)
                    }
                    ForEach(section.items) { product in
                        NavigationLink(destination: ProductDetailView(productId: product.id, repository: container.productRepository)) {
                            ProductCardView(
                                product: product,
                                isRetrying: viewModel.retryingIds.contains(product.id),
                                checkIntervalSeconds: viewModel.checkIntervalSeconds,
                                onRetry: { Task { await viewModel.retry(id: product.id) } }
                            )
                        }
                        .buttonStyle(.plain)
                    }
                }
            }
        }
        .onAppear {
            // `.task` already loaded once; ensure `viewModel` uses the real repository from here on.
        }
    }
}

private struct GroupChip: View {
    let title: String
    let isSelected: Bool
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(Typography.body(12.5, weight: .semibold))
                .foregroundStyle(isSelected ? Palette.accentOnFill : Palette.secondaryText)
                .padding(.horizontal, 14)
                .padding(.vertical, 8)
        }
        .background(isSelected ? Palette.ink : Palette.pillBackground)
        .clipShape(Capsule())
    }
}
