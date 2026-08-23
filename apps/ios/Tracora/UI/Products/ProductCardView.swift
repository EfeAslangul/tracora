import Foundation
import SwiftUI
import Charts

struct ProductCardView: View {
    let product: ProductListItem
    var isRetrying: Bool = false
    var checkIntervalSeconds: Int = 86_400
    var onRetry: () -> Void = {}

    private var changePercent: Double? {
        guard let current = product.currentPrice, let previous = product.previousPrice, previous != 0 else { return nil }
        return ((current - previous) / previous) * 100
    }

    /// `inStock` üç durumludur: henüz bir gözlem yoksa (ya da site stok bilgisi
    /// vermiyorsa) nil kalır. Bunu "Stokta" saymak kullanıcıya doğrulanmamış bir
    /// bilgiyi kesinmiş gibi gösterir; web ile aynı sözleşme kullanılır.
    private var stockLabel: String {
        switch product.inStock {
        case true: return "Stokta"
        case false: return "Tükendi"
        case nil: return "Bilinmiyor"
        }
    }

    private var stockColor: Color {
        switch product.inStock {
        case true: return Palette.success
        case false: return Palette.danger
        case nil: return Palette.tertiaryText
        }
    }

    var body: some View {
        // Not a Button: this card is always used as a NavigationLink label (see
        // ProductListView). A Button nested inside a NavigationLink's label competes
        // for the same tap and can win, silently swallowing navigation.
        Group {
            HStack(alignment: .top, spacing: 14) {
                RoundedRectangle(cornerRadius: 14, style: .continuous)
                    .fill(Palette.imagePlaceholder)
                    .frame(width: 76, height: 88)
                    .overlay(
                        Text("görsel")
                            .font(Typography.body(9))
                            .foregroundStyle(Palette.tertiaryText),
                        alignment: .bottom
                    )
                    .padding(.bottom, 8)

                VStack(alignment: .leading, spacing: 6) {
                    HStack(alignment: .top) {
                        VStack(alignment: .leading, spacing: 3) {
                            Text(product.name ?? product.hostname)
                                .font(Typography.body(14.5, weight: .semibold))
                                .foregroundStyle(Palette.ink)
                                .lineLimit(2)
                            Text(product.hostname)
                                .font(Typography.body(11.5))
                                .foregroundStyle(Palette.tertiaryText)
                        }
                        Spacer()
                        if product.status == .failed {
                            PillBadge(text: "FAILED", foreground: Palette.warning, background: Palette.warningBackground)
                        } else if let percent = changePercent {
                            PillBadge(
                                text: String(format: "%@%.0f%%", percent <= 0 ? "−" : "+", abs(percent)),
                                foreground: percent <= 0 ? Palette.success : Palette.danger,
                                background: percent <= 0 ? Palette.successBackground : Palette.dangerBackground
                            )
                        }
                    }

                    if product.status == .failed {
                        Text(product.lastError?.message ?? "Fiyat bu sayfadan okunamadı.")
                            .font(Typography.body(11.5))
                            .foregroundStyle(Palette.warning)
                            .padding(9)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Palette.warningBackground)
                            .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))
                        if isRetrying {
                            Text("Yeniden deneniyor…")
                                .font(Typography.body(11.5, weight: .semibold))
                                .foregroundStyle(Palette.accent)
                        } else {
                            Button("Yeniden dene", action: onRetry)
                                .font(Typography.body(11.5, weight: .semibold))
                                .foregroundStyle(Palette.accent)
                        }
                    } else {
                        HStack(alignment: .lastTextBaseline) {
                            VStack(alignment: .leading, spacing: 3) {
                                Text(priceText(product.currentPrice, product.currency))
                                    .font(Typography.price(28))
                                    .foregroundStyle(Palette.ink)
                                if let previous = product.previousPrice {
                                    Text(priceText(previous, product.currency))
                                        .font(Typography.body(11.5))
                                        .foregroundStyle(Palette.tertiaryText)
                                        .strikethrough()
                                }
                            }
                            Spacer()
                            Sparkline(color: (changePercent ?? 0) <= 0 ? Palette.success : Palette.danger)
                                .frame(width: 86, height: 34)
                        }

                        HStack(spacing: 12) {
                            HStack(spacing: 5) {
                                StatusDot(color: stockColor)
                                Text(stockLabel)
                            }
                            Text(product.targetPrice != nil ? "Hedef \(priceText(product.targetPrice, product.currency))" : "Hedef yok")
                            Spacer()
                            if let checked = product.lastCheckedAt {
                                Text(shortTime(checked))
                            }
                        }
                        .font(Typography.body(11.5))
                        .foregroundStyle(Palette.secondaryText)
                        .padding(.top, 8)
                        .overlay(Rectangle().fill(Palette.border).frame(height: 1), alignment: .top)

                        if let nextCheck = nextCheckText(lastCheckedAt: product.lastCheckedAt, intervalSeconds: checkIntervalSeconds) {
                            Text(nextCheck)
                                .font(Typography.body(11))
                                .foregroundStyle(Palette.tertiaryText)
                        }
                    }
                }
            }
            .padding(14)
        }
        .contentShape(Rectangle())
        .background(Palette.surface)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Palette.border, lineWidth: 1))
    }
}

private struct Sparkline: View {
    let color: Color
    var body: some View {
        // A decorative trend hint on the card, not a real time-series axis — matches the mock's
        // small inline SVG polyline. The full price-history chart lives on the detail screen.
        GeometryReader { proxy in
            Path { path in
                let points: [CGFloat] = [0.2, 0.3, 0.15, 0.5, 0.4, 0.7, 0.85]
                let stepX = proxy.size.width / CGFloat(points.count - 1)
                for (index, value) in points.enumerated() {
                    let point = CGPoint(x: CGFloat(index) * stepX, y: proxy.size.height * (1 - value))
                    if index == 0 { path.move(to: point) } else { path.addLine(to: point) }
                }
            }
            .stroke(color, style: StrokeStyle(lineWidth: 2, lineCap: .round, lineJoin: .round))
        }
    }
}

func priceText(_ value: Double?, _ currency: String?) -> String {
    guard let value else { return "— ₺" }
    let formatted = value.formatted(.number.precision(.fractionLength(0)))
    return "\(formatted) \(currency == "TRY" ? "₺" : (currency ?? ""))"
}

/// The API serializes `Date` via JS's `toISOString()`, which always includes
/// milliseconds (e.g. "2026-08-22T21:04:22.000Z"). The plain `ISO8601DateFormatter()`
/// (no `.withFractionalSeconds`) silently fails to parse that and returns nil.
func parseApiDate(_ iso: String) -> Date? {
    let withFraction = ISO8601DateFormatter()
    withFraction.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    if let date = withFraction.date(from: iso) { return date }
    return ISO8601DateFormatter().date(from: iso)
}

func shortTime(_ iso: String) -> String {
    guard let date = parseApiDate(iso) else { return "" }
    let out = DateFormatter()
    out.dateFormat = "HH:mm"
    return out.string(from: date)
}

/// FAILED ürünlerde gösterilmez: `checkIntervalSeconds` yeni bir otomatik kontrolü
/// varsayar, ama başarısız bir ürün elle "Yeniden dene"nmeden tekrar denenmez.
func nextCheckText(lastCheckedAt: String?, intervalSeconds: Int) -> String? {
    guard let lastCheckedAt, let checked = parseApiDate(lastCheckedAt) else {
        return nil
    }
    let remaining = checked.addingTimeInterval(TimeInterval(intervalSeconds)).timeIntervalSinceNow
    if remaining <= 60 { return "Sonraki kontrol birazdan" }
    let hours = Int(remaining / 3_600)
    if hours >= 1 { return "Sonraki kontrol ~\(hours) sa sonra" }
    let minutes = max(1, Int(remaining / 60))
    return "Sonraki kontrol ~\(minutes) dk sonra"
}
