import SwiftUI

enum RootDestination {
    case login
    case onboarding
    case products
}

@MainActor
final class RootViewModel: ObservableObject {
    @Published var destination: RootDestination = .login
    @Published var isResolving = true

    private let container: AppContainer

    init(container: AppContainer) {
        self.container = container
    }

    func resolve() async {
        guard container.authService.currentUser != nil else {
            destination = .login
            isResolving = false
            return
        }
        await checkSetup()
    }

    func checkSetup() async {
        isResolving = true
        do {
            let status = try await container.productRepository.getSetupStatus()
            destination = status.required ? .onboarding : .products
        } catch {
            // If we can't reach the setup endpoint (e.g. offline), don't block the user out —
            // fall through to the product list, which has its own error handling.
            destination = .products
        }
        isResolving = false
    }
}

struct RootView: View {
    @EnvironmentObject var container: AppContainer
    @StateObject private var viewModel: RootViewModel

    init(container: AppContainer) {
        _viewModel = StateObject(wrappedValue: RootViewModel(container: container))
    }

    var body: some View {
        Group {
            if viewModel.isResolving {
                ZStack {
                    Palette.background.ignoresSafeArea()
                    ProgressView().tint(Palette.accent)
                }
            } else {
                switch viewModel.destination {
                case .login:
                    LoginView(authService: container.authService, onAuthenticated: { Task { await viewModel.checkSetup() } })
                case .onboarding:
                    OnboardingView(repository: container.productRepository, onCompleted: { viewModel.destination = .products })
                case .products:
                    ProductListView(repository: container.productRepository)
                }
            }
        }
        .task { await viewModel.resolve() }
        .onReceive(container.authService.$currentUser) { user in
            if user == nil {
                viewModel.destination = .login
                viewModel.isResolving = false
            }
        }
    }
}
