import SwiftUI

/// Type scale for Direction 1a: Newsreader serif for prices/headlines, Manrope for UI copy.
/// Falls back to system serif/rounded fonts if the bundled files failed to register, so the app
/// never crashes or renders blank text (see `FontRegistration`).
enum Typography {
    static func price(_ size: CGFloat) -> Font {
        FontRegistration.newsreaderAvailable
            ? .custom("Newsreader-Regular", size: size)
            : .system(size: size, weight: .regular, design: .serif)
    }

    static func serifHeadline(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        guard FontRegistration.newsreaderAvailable else {
            return .system(size: size, weight: weight, design: .serif)
        }
        switch weight {
        case .semibold, .bold: return .custom("Newsreader-SemiBold", size: size)
        case .medium: return .custom("NewsreaderMedium-Regular", size: size)
        default: return .custom("Newsreader-Regular", size: size)
        }
    }

    static func body(_ size: CGFloat, weight: Font.Weight = .regular) -> Font {
        guard FontRegistration.manropeAvailable else {
            return .system(size: size, weight: weight, design: .rounded)
        }
        switch weight {
        case .bold, .heavy: return .custom("Manrope-Bold", size: size)
        case .semibold: return .custom("ManropeSemiBold-Regular", size: size)
        case .medium: return .custom("ManropeMedium-Regular", size: size)
        default: return .custom("Manrope-Regular", size: size)
        }
    }
}
