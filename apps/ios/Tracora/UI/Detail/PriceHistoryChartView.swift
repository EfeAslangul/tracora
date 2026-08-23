import Foundation
import SwiftUI
import Charts

struct PriceHistoryChartView: View {
    let points: [PriceHistoryPoint]
    let targetPrice: Double?
    @Binding var windowDays: Int

    private var filtered: [PriceHistoryPoint] {
        guard let cutoff = Calendar.current.date(byAdding: .day, value: -windowDays, to: Date()) else { return points }
        return points.filter { point in
            guard let date = parseApiDate(point.observedAt) else { return true }
            return date >= cutoff
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("Fiyat geçmişi")
                    .font(Typography.body(12.5, weight: .semibold))
                    .foregroundStyle(Palette.secondaryText)
                Spacer()
                HStack(spacing: 6) {
                    windowButton(7, label: "7g")
                    windowButton(30, label: "30g")
                    windowButton(90, label: "90g")
                }
            }

            if filtered.isEmpty {
                Text("Henüz fiyat geçmişi yok.")
                    .font(Typography.body(13))
                    .foregroundStyle(Palette.tertiaryText)
                    .frame(height: 150)
            } else {
                Chart {
                    ForEach(filtered) { point in
                        AreaMark(x: .value("Date", point.observedAt), y: .value("Price", point.price))
                            .foregroundStyle(Palette.accent.opacity(0.08))
                        LineMark(x: .value("Date", point.observedAt), y: .value("Price", point.price))
                            .foregroundStyle(Palette.accent)
                            .lineStyle(StrokeStyle(lineWidth: 2.4, lineJoin: .round))
                    }
                    if let targetPrice {
                        RuleMark(y: .value("Target", targetPrice))
                            .foregroundStyle(Palette.danger)
                            .lineStyle(StrokeStyle(lineWidth: 1.4, dash: [5, 5]))
                    }
                }
                .chartXAxis(.hidden)
                .chartYAxis(.hidden)
                .frame(height: 150)
            }
        }
        .padding(16)
        .background(Palette.surface)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Palette.border, lineWidth: 1))
    }

    private func windowButton(_ days: Int, label: String) -> some View {
        Button(action: { windowDays = days }) {
            Text(label)
                .font(Typography.body(11, weight: .semibold))
                .foregroundStyle(windowDays == days ? Palette.accentOnFill : Palette.secondaryText)
                .padding(.horizontal, 9)
                .padding(.vertical, 5)
        }
        .background(windowDays == days ? Palette.ink : Palette.pillBackground)
        .clipShape(Capsule())
    }
}

struct DistanceToTargetCardView: View {
    let currentPrice: Double?
    let targetPrice: Double
    let startPrice: Double?
    let currency: String?

    private var progress: Double {
        guard let currentPrice, let startPrice, startPrice != targetPrice else { return 0 }
        let value = (startPrice - currentPrice) / (startPrice - targetPrice)
        return min(max(value, 0), 1)
    }

    private var remaining: Double {
        guard let currentPrice else { return 0 }
        return max(currentPrice - targetPrice, 0)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                Text("Hedefe kalan")
                    .font(Typography.body(12.5, weight: .semibold))
                    .foregroundStyle(Palette.secondaryText)
                Spacer()
                Text(priceText(remaining, currency))
                    .font(Typography.body(12.5, weight: .semibold))
                    .foregroundStyle(Palette.accent)
            }
            GeometryReader { proxy in
                ZStack(alignment: .leading) {
                    Capsule().fill(Palette.pillBackground)
                    Capsule().fill(Palette.accent).frame(width: proxy.size.width * progress)
                }
            }
            .frame(height: 8)
            HStack {
                Text("Hedef \(priceText(targetPrice, currency))")
                Spacer()
                if let startPrice {
                    Text("Başlangıç \(priceText(startPrice, currency))")
                }
            }
            .font(Typography.body(11))
            .foregroundStyle(Palette.tertiaryText)
        }
        .padding(16)
        .background(Palette.surface)
        .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
        .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Palette.border, lineWidth: 1))
    }
}

struct EventsTimelineView: View {
    let events: [ProductEvent]

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Text("OLAYLAR")
                .font(Typography.body(12.5, weight: .bold))
                .foregroundStyle(Palette.tertiaryText)
                .padding(.bottom, 8)
            ForEach(Array(events.enumerated()), id: \.element.id) { index, event in
                HStack(alignment: .top, spacing: 12) {
                    Circle()
                        .fill(event.code == nil ? Palette.success : Palette.tertiaryText)
                        .frame(width: 6, height: 6)
                        .padding(.top, 6)
                    VStack(alignment: .leading, spacing: 2) {
                        Text(event.message)
                            .font(Typography.body(13.5, weight: .semibold))
                            .foregroundStyle(Palette.ink)
                        Text(shortDate(event.createdAt))
                            .font(Typography.body(11.5))
                            .foregroundStyle(Palette.tertiaryText)
                    }
                    Spacer()
                }
                .padding(.vertical, 12)
                .overlay(
                    index < events.count - 1
                        ? AnyView(Rectangle().fill(Palette.border).frame(height: 1).padding(.top, 44))
                        : AnyView(EmptyView()),
                    alignment: .top
                )
            }
        }
    }
}

private func shortDate(_ iso: String) -> String {
    guard let date = parseApiDate(iso) else { return iso }
    let out = DateFormatter()
    out.dateFormat = "d MMM HH:mm"
    out.locale = Locale(identifier: "tr_TR")
    return out.string(from: date)
}
