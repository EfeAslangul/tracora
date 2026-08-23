import SwiftUI

@MainActor
final class AddProductViewModel: ObservableObject {
    @Published var url = ""
    @Published var targetPrice = ""
    @Published var notificationsEnabled = true
    @Published var isSubmitting = false
    @Published var errorMessage: String?

    private let repository: ProductRepository

    init(repository: ProductRepository) {
        self.repository = repository
    }

    func submit(onSuccess: @escaping () -> Void) async {
        guard !url.trimmingCharacters(in: .whitespaces).isEmpty else {
            errorMessage = "Ürün bağlantısı gerekli."
            return
        }
        isSubmitting = true
        errorMessage = nil
        do {
            _ = try await repository.createProduct(
                url: url.trimmingCharacters(in: .whitespaces),
                targetPrice: Double(targetPrice.replacingOccurrences(of: ",", with: ".")),
                notificationsEnabled: notificationsEnabled
            )
            onSuccess()
        } catch let error as ApiException {
            errorMessage = error.message
        } catch {
            errorMessage = error.localizedDescription
        }
        isSubmitting = false
    }
}

struct AddProductSheetView: View {
    @StateObject private var viewModel: AddProductViewModel
    @Environment(\.dismiss) private var dismiss
    let groups: [String]
    let onAdded: () -> Void
    @State private var selectedGroup: String?

    init(repository: ProductRepository, groups: [String], onAdded: @escaping () -> Void) {
        _viewModel = StateObject(wrappedValue: AddProductViewModel(repository: repository))
        self.groups = groups
        self.onAdded = onAdded
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    Button("İptal") { dismiss() }
                        .font(Typography.body(14, weight: .semibold))
                        .foregroundStyle(Palette.secondaryText)
                    Spacer()
                    Button(viewModel.isSubmitting ? "Ekleniyor…" : "Ekle") {
                        Task {
                            await viewModel.submit {
                                onAdded()
                                dismiss()
                            }
                        }
                    }
                    .font(Typography.body(14, weight: .semibold))
                    .foregroundStyle(Palette.accent)
                    .disabled(viewModel.isSubmitting)
                }

                Text("Yeni ürün")
                    .font(Typography.serifHeadline(30))
                    .foregroundStyle(Palette.ink)

                VStack(spacing: 14) {
                    TracoraTextField(label: "Ürün bağlantısı", text: $viewModel.url, placeholder: "https://…", keyboardType: .URL)
                    TracoraTextField(label: "Hedef fiyat · isteğe bağlı", text: $viewModel.targetPrice, placeholder: "0", keyboardType: .decimalPad)

                    if !groups.isEmpty {
                        VStack(alignment: .leading, spacing: 7) {
                            Text("Grup")
                                .font(Typography.body(12.5, weight: .semibold))
                                .foregroundStyle(Palette.secondaryText)
                            FlowChips(groups: groups, selected: $selectedGroup)
                        }
                    }

                    Toggle("Bildirim açık", isOn: $viewModel.notificationsEnabled)
                        .font(Typography.body(13))
                        .tint(Palette.accent)

                    Text("İlk kontrol eklemeden hemen sonra yapılır, sonrası günde bir kez. Login veya CAPTCHA isteyen sayfalarda okuma garanti değildir.")
                        .font(Typography.body(12.5))
                        .foregroundStyle(Palette.secondaryText)
                }

                if let error = viewModel.errorMessage {
                    Text(error).font(Typography.body(13)).foregroundStyle(Palette.danger)
                }
            }
            .padding(20)
        }
        .background(Palette.background.ignoresSafeArea())
    }
}

private struct FlowChips: View {
    let groups: [String]
    @Binding var selected: String?

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(groups, id: \.self) { group in
                    Button(action: { selected = (selected == group) ? nil : group }) {
                        Text(group)
                            .font(Typography.body(13, weight: .semibold))
                            .foregroundStyle(selected == group ? Palette.accentOnFill : Palette.secondaryText)
                            .padding(.horizontal, 13)
                            .padding(.vertical, 9)
                    }
                    .background(selected == group ? Palette.accent : Palette.surface)
                    .clipShape(Capsule())
                    .overlay(Capsule().strokeBorder(Palette.border, lineWidth: selected == group ? 0 : 1))
                }
            }
        }
    }
}
