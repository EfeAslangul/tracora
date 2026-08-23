import SwiftUI

@MainActor
final class LoginViewModel: ObservableObject {
    @Published var email = ""
    @Published var password = ""
    @Published var isSubmitting = false
    @Published var errorMessage: String?

    private let authService: FirebaseAuthService

    var isConfigured: Bool { authService.isConfigured }

    init(authService: FirebaseAuthService) {
        self.authService = authService
    }

    func signIn(onSuccess: @escaping () -> Void) async {
        await submit(onSuccess: onSuccess) { try await authService.signIn(email: self.email, password: self.password) }
    }

    func createAccount(onSuccess: @escaping () -> Void) async {
        await submit(onSuccess: onSuccess) { try await authService.createAccount(email: self.email, password: self.password) }
    }

    private func submit(onSuccess: @escaping () -> Void, action: () async throws -> Void) async {
        guard !email.isEmpty, !password.isEmpty else {
            errorMessage = "E-posta ve şifre gerekli."
            return
        }
        isSubmitting = true
        errorMessage = nil
        do {
            try await action()
            onSuccess()
        } catch {
            errorMessage = (error as? LocalizedError)?.errorDescription ?? error.localizedDescription
        }
        isSubmitting = false
    }
}

struct LoginView: View {
    @StateObject private var viewModel: LoginViewModel
    let onAuthenticated: () -> Void

    init(authService: FirebaseAuthService, onAuthenticated: @escaping () -> Void) {
        self.onAuthenticated = onAuthenticated
        _viewModel = StateObject(wrappedValue: LoginViewModel(authService: authService))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                RoundedRectangle(cornerRadius: 16, style: .continuous)
                    .fill(Palette.accent)
                    .frame(width: 52, height: 52)
                    .overlay(Text("T").font(Typography.serifHeadline(30)).foregroundStyle(Palette.accentOnFill))

                Text("Tracora")
                    .font(Typography.serifHeadline(44))
                    .foregroundStyle(Palette.ink)
                    .padding(.top, 28)

                Text("Ürün bağlantılarını ekleyin, fiyat ve stok değişimini günde bir kez izleyelim.")
                    .font(Typography.body(15))
                    .foregroundStyle(Palette.secondaryText)
                    .frame(maxWidth: 280, alignment: .leading)
                    .padding(.top, 10)

                if !viewModel.isConfigured {
                    Text("Firebase henüz yapılandırılmadı. apps/ios/README.md dosyasına bakın.")
                        .font(Typography.body(12.5, weight: .semibold))
                        .foregroundStyle(Palette.warning)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Palette.warningBackground)
                        .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        .padding(.top, 20)
                }

                VStack(spacing: 14) {
                    TracoraTextField(label: "E-posta", text: $viewModel.email, placeholder: "you@example.com", keyboardType: .emailAddress)
                    TracoraTextField(label: "Şifre", text: $viewModel.password, placeholder: "••••••••", isSecure: true)
                }
                .padding(.top, 44)

                if let error = viewModel.errorMessage {
                    Text(error)
                        .font(Typography.body(13))
                        .foregroundStyle(Palette.danger)
                        .padding(.top, 10)
                }

                PrimaryButton(title: "Giriş yap", isLoading: viewModel.isSubmitting, isDisabled: !viewModel.isConfigured) {
                    Task { await viewModel.signIn(onSuccess: onAuthenticated) }
                }
                .padding(.top, 26)

                SecondaryButton(title: "Kayıt oluştur") {
                    Task { await viewModel.createAccount(onSuccess: onAuthenticated) }
                }
                .padding(.top, 10)
                .disabled(!viewModel.isConfigured)

                HStack(spacing: 8) {
                    StatusDot(color: Palette.success, size: 7)
                    Text("Sistem hazır · günde bir kontrol")
                        .font(Typography.body(12.5))
                        .foregroundStyle(Palette.secondaryText)
                }
                .padding(.top, 44)
            }
            .padding(.horizontal, 28)
            .padding(.top, 80)
            .padding(.bottom, 40)
        }
        .background(Palette.background.ignoresSafeArea())
    }
}
