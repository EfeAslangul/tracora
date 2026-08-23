import SwiftUI

private extension Color {
    /// Builds a dynamic color from separate light/dark hex values so every view can stay
    /// declarative (no `\.colorScheme` branching sprinkled everywhere) — this is what lets the
    /// mock's dark-theme product-list variant "fall out" of the same views for free.
    init(light: UInt32, dark: UInt32) {
        self = Color(uiColor: UIColor { trait in
            trait.userInterfaceStyle == .dark ? UIColor(hex: dark) : UIColor(hex: light)
        })
    }
}

private extension UIColor {
    convenience init(hex: UInt32) {
        let r = CGFloat((hex >> 16) & 0xFF) / 255
        let g = CGFloat((hex >> 8) & 0xFF) / 255
        let b = CGFloat(hex & 0xFF) / 255
        self.init(red: r, green: g, blue: b, alpha: 1)
    }
}

/// Semantic color tokens for Direction 1a ("calm iris"). Views must always read colors from here,
/// never inline a hex — that's what makes the dark variant automatic.
enum Palette {
    static let background = Color(light: 0xF5F4FB, dark: 0x16132A)
    static let surface = Color(light: 0xFFFFFF, dark: 0x201C38)
    static let ink = Color(light: 0x1B1930, dark: 0xF1EFFA)
    static let secondaryText = Color(light: 0x6F6B8A, dark: 0x9A93B8)
    static let tertiaryText = Color(light: 0x9A95B8, dark: 0x837DA0)
    static let border = Color(light: 0xE4E1F2, dark: 0x2C2650)
    static let pillBackground = Color(light: 0xECEAF7, dark: 0x241F3E)
    static let accent = Color(light: 0x5A4FCF, dark: 0xA99BFF)
    static let accentOnFill = Color(light: 0xFFFFFF, dark: 0x16132A)

    static let success = Color(light: 0x3E8E7E, dark: 0x8AE0BE)
    static let successBackground = Color(light: 0xE6F1EE, dark: 0x14322A)
    static let danger = Color(light: 0xC05F5F, dark: 0xF0A08C)
    static let dangerBackground = Color(light: 0xF8ECEC, dark: 0x3A241E)
    static let warning = Color(light: 0x8A6A1F, dark: 0xE0B96A)
    static let warningBackground = Color(light: 0xF6EFDA, dark: 0x3A2E14)

    static let imagePlaceholder = Color(light: 0xECEAF7, dark: 0x282246)
    static let dashedBorder = Color(light: 0xC9C4DE, dark: 0x3A3364)
}
