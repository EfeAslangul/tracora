import UIKit

/// Defensive check that the bundled Newsreader/Manrope fonts actually registered (they're loaded
/// via `Info.plist`'s `UIAppFonts`, which iOS processes at launch — this just verifies it worked
/// so `Typography.swift` can fall back to system fonts instead of silently rendering nothing).
enum FontRegistration {
    static let newsreaderAvailable: Bool = UIFont.familyNames.contains { $0.hasPrefix("Newsreader") }
    static let manropeAvailable: Bool = UIFont.familyNames.contains { $0.hasPrefix("Manrope") }
}
