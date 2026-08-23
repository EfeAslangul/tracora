import SwiftUI

@main
struct TracoraApp: App {
    @StateObject private var container = AppContainer()

    var body: some Scene {
        WindowGroup {
            RootView(container: container)
                .environmentObject(container)
                .tint(Palette.accent)
        }
    }
}
