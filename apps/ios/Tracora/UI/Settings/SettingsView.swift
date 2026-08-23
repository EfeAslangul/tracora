import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var container: AppContainer
    @State private var showDeleteConfirm = false
    @State private var isDeleting = false
    @State private var errorMessage: String?

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 18) {
                Text("Ayarlar")
                    .font(Typography.serifHeadline(30))
                    .foregroundStyle(Palette.ink)

                SecondaryButton(title: "Çıkış yap") {
                    container.authService.signOut()
                }

                if let error = errorMessage {
                    Text(error).font(Typography.body(13)).foregroundStyle(Palette.danger)
                }

                Button(action: { showDeleteConfirm = true }) {
                    Text(isDeleting ? "Siliniyor…" : "Hesabı sil")
                        .font(Typography.body(15, weight: .semibold))
                        .foregroundStyle(Palette.danger)
                        .frame(maxWidth: .infinity)
                        .frame(minHeight: 52)
                }
                .background(Palette.dangerBackground)
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                .disabled(isDeleting)
            }
            .padding(20)
        }
        .background(Palette.background.ignoresSafeArea())
        .alert("Hesabı sil", isPresented: $showDeleteConfirm) {
            Button("Sil", role: .destructive) { Task { await deleteAccount() } }
            Button("Vazgeç", role: .cancel) {}
        } message: {
            Text("Bu işlem geri alınamaz. Tüm ürünleriniz ve hesabınız silinir.")
        }
    }

    private func deleteAccount() async {
        isDeleting = true
        errorMessage = nil
        do {
            try await container.productRepository.deleteMe()
            try await container.authService.deleteAccount()
        } catch let error as ApiException {
            errorMessage = error.message
        } catch {
            errorMessage = error.localizedDescription
        }
        isDeleting = false
    }
}
