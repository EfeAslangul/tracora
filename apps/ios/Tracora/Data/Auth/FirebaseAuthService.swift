import Foundation
import FirebaseCore
import FirebaseAuth

/// Wraps Firebase Auth (email/password only for v1). Mirrors the lazy, null-safe pattern in
/// `apps/web/src/services/firebase.ts`: nothing crashes when Firebase isn't configured yet — the
/// app simply behaves as signed-out and callers see `isConfigured == false`.
@MainActor
final class FirebaseAuthService: ObservableObject {
    @Published private(set) var currentUser: User?
    let isConfigured: Bool

    init() {
        isConfigured = FirebaseAuthService.configureIfPossible()
        if isConfigured {
            currentUser = Auth.auth().currentUser
            Auth.auth().addStateDidChangeListener { [weak self] _, user in
                self?.currentUser = user
            }
        }
    }

    private static func configureIfPossible() -> Bool {
        guard let path = Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist"),
              let options = FirebaseOptions(contentsOfFile: path),
              let apiKey = options.apiKey,
              apiKey != "REPLACE_ME",
              !apiKey.isEmpty else {
            return false
        }
        if FirebaseApp.app() == nil {
            FirebaseApp.configure(options: options)
        }
        return true
    }

    func signIn(email: String, password: String) async throws {
        guard isConfigured else { throw AuthError.notConfigured }
        _ = try await Auth.auth().signIn(withEmail: email, password: password)
    }

    func createAccount(email: String, password: String) async throws {
        guard isConfigured else { throw AuthError.notConfigured }
        _ = try await Auth.auth().createUser(withEmail: email, password: password)
    }

    func signOut() {
        guard isConfigured else { return }
        try? Auth.auth().signOut()
    }

    func deleteAccount() async throws {
        guard isConfigured, let user = Auth.auth().currentUser else { throw AuthError.notConfigured }
        try await user.delete()
    }

    func currentIdToken() async -> String? {
        guard isConfigured, let user = Auth.auth().currentUser else { return nil }
        return try? await user.getIDToken()
    }
}

enum AuthError: LocalizedError {
    case notConfigured

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            return "Firebase henüz yapılandırılmadı. apps/ios/README.md dosyasına bakın."
        }
    }
}
