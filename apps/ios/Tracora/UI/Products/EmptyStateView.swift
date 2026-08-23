import SwiftUI

struct EmptyStateView: View {
    let onAddProduct: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: "chart.line.uptrend.xyaxis")
                .font(.system(size: 40))
                .foregroundStyle(Palette.accent)
            Text("Henüz izlenen ürün yok")
                .font(Typography.serifHeadline(24))
                .foregroundStyle(Palette.ink)
            Text("Bir ürün bağlantısı ekleyin, dilerseniz gruplayın; ilk fiyatı hemen okuyup her gün karşılaştırırız.")
                .font(Typography.body(14))
                .foregroundStyle(Palette.secondaryText)
                .multilineTextAlignment(.center)
                .frame(maxWidth: 250)
            Button(action: onAddProduct) {
                Text("Ürün ekle")
                    .font(Typography.body(15, weight: .semibold))
                    .foregroundStyle(Palette.accentOnFill)
                    .padding(.horizontal, 22)
                    .frame(minHeight: 52)
            }
            .background(Palette.accent)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .padding(.top, 6)
        }
        .padding(.horizontal, 10)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

struct LoadingSkeletonView: View {
    var body: some View {
        VStack(spacing: 12) {
            ForEach(0..<3, id: \.self) { index in
                HStack(spacing: 14) {
                    RoundedRectangle(cornerRadius: 14, style: .continuous)
                        .fill(Palette.imagePlaceholder)
                        .frame(width: 76, height: 88)
                    VStack(alignment: .leading, spacing: 9) {
                        RoundedRectangle(cornerRadius: 6).fill(Palette.imagePlaceholder).frame(width: 140, height: 12)
                        RoundedRectangle(cornerRadius: 8).fill(Palette.imagePlaceholder).frame(width: 90, height: 24)
                        RoundedRectangle(cornerRadius: 5).fill(Palette.imagePlaceholder.opacity(0.7)).frame(height: 10)
                    }
                    Spacer()
                }
                .padding(14)
                .background(Palette.surface)
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .overlay(RoundedRectangle(cornerRadius: 20, style: .continuous).strokeBorder(Palette.border, lineWidth: 1))
                .opacity(1 - Double(index) * 0.22)
            }
            Text("Ürünler yükleniyor…")
                .font(Typography.body(12.5))
                .foregroundStyle(Palette.tertiaryText)
                .padding(.top, 8)
        }
    }
}
