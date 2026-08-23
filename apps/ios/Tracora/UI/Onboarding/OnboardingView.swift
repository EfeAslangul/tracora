import Foundation
import SwiftUI

private let maxOnboardingURLs = 20

@MainActor
final class OnboardingViewModel: ObservableObject {
    @Published var urls: [String] = [""]
    @Published var isSubmitting = false
    @Published var errorMessage: String?

    private let repository: ProductRepository

    init(repository: ProductRepository) {
        self.repository = repository
    }

    var validCount: Int { urls.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }.count }
    var canAddMore: Bool { urls.count < maxOnboardingURLs }

    func addRow() {
        guard canAddMore else { return }
        urls.append("")
    }

    func removeRow(at index: Int) {
        guard urls.indices.contains(index) else { return }
        urls.remove(at: index)
    }

    func submit(onCompleted: @escaping () -> Void) async {
        let products = urls
            .map { $0.trimmingCharacters(in: .whitespacesAndNewlines) }
            .filter { !$0.isEmpty }
            .map { SetupProductInput(url: $0, targetPrice: nil, notificationsEnabled: true) }

        guard !products.isEmpty else {
            errorMessage = "En az bir ürün bağlantısı ekleyin."
            return
        }

        isSubmitting = true
        errorMessage = nil
        do {
            let result = try await repository.postSetup(products: products)
            if result.completed {
                onCompleted()
            } else {
                errorMessage = "Hiçbir bağlantı takibe alınamadı."
            }
        } catch let error as ApiException {
            errorMessage = error.message
        } catch {
            errorMessage = error.localizedDescription
        }
        isSubmitting = false
    }
}

struct OnboardingView: View {
    @StateObject private var viewModel: OnboardingViewModel
    let onCompleted: () -> Void

    init(repository: ProductRepository, onCompleted: @escaping () -> Void) {
        self.onCompleted = onCompleted
        _viewModel = StateObject(wrappedValue: OnboardingViewModel(repository: repository))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("1. KURULUM")
                    .font(Typography.body(11.5, weight: .bold))
                    .foregroundStyle(Palette.accent)

                Text("Takip listenizi\noluşturun")
                    .font(Typography.serifHeadline(34))
                    .foregroundStyle(Palette.ink)
                    .padding(.top, 10)

                Text("Tek seferde en fazla \(maxOnboardingURLs) bağlantı. En az bir ürün eklendiğinde kurulum tamamlanır.")
                    .font(Typography.body(14))
                    .foregroundStyle(Palette.secondaryText)
                    .padding(.top, 10)

                VStack(spacing: 10) {
                    ForEach(viewModel.urls.indices, id: \.self) { index in
                        OnboardingURLRow(
                            index: index,
                            text: Binding(
                                get: { viewModel.urls[index] },
                                set: { viewModel.urls[index] = $0 }
                            ),
                            onRemove: viewModel.urls.count > 1 ? { viewModel.removeRow(at: index) } : nil
                        )
                    }

                    if viewModel.canAddMore {
                        Button(action: { viewModel.addRow() }) {
                            HStack(spacing: 8) {
                                Image(systemName: "plus")
                                Text("Bağlantı ekle")
                            }
                            .font(Typography.body(14, weight: .semibold))
                            .foregroundStyle(Palette.accent)
                        }
                        .padding(.vertical, 12)
                    }
                }
                .padding(.top, 26)

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(Typography.body(13))
                        .foregroundStyle(Palette.danger)
                        .padding(.top, 8)
                }

                Text("İlk kontrol hemen çalışır, sonraki kontroller 24 saatte bir.")
                    .font(Typography.body(12.5))
                    .foregroundStyle(Palette.secondaryText)
                    .padding(.top, 26)

                PrimaryButton(
                    title: "Takibi başlat · \(viewModel.validCount) ürün",
                    isLoading: viewModel.isSubmitting,
                    isDisabled: viewModel.validCount == 0
                ) {
                    Task { await viewModel.submit(onCompleted: onCompleted) }
                }
                .padding(.top, 12)
            }
            .padding(.horizontal, 22)
            .padding(.top, 74)
            .padding(.bottom, 40)
        }
        .background(Palette.background.ignoresSafeArea())
    }
}

private struct OnboardingURLRow: View {
    let index: Int
    @Binding var text: String
    let onRemove: (() -> Void)?

    var body: some View {
        HStack(spacing: 8) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(String(format: "%02d", index + 1))
                        .font(Typography.body(11, weight: .bold))
                        .foregroundStyle(Palette.tertiaryText)
                    Spacer()
                    if !text.trimmingCharacters(in: .whitespaces).isEmpty {
                        Text("hazır")
                            .font(Typography.body(11.5, weight: .semibold))
                            .foregroundStyle(Palette.success)
                    }
                }
                TextField("https://…", text: $text)
                    .font(Typography.body(14))
                    .foregroundStyle(Palette.ink)
                    .autocapitalization(.none)
                    .disableAutocorrection(true)
                    .keyboardType(.URL)
            }
            .padding(14)
            .background(Palette.surface)
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
            .overlay(
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .strokeBorder(Palette.border, lineWidth: 1)
            )

            if let onRemove {
                Button(action: onRemove) {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Palette.tertiaryText)
                }
            }
        }
    }
}
