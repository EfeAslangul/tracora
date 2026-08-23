import Foundation

enum ProductStatus: String, Codable {
    case pending = "PENDING"
    case active = "ACTIVE"
    case paused = "PAUSED"
    case failed = "FAILED"
}

struct ApiErrorInfo: Codable {
    let code: String
    let message: String
}

struct ProductListItem: Codable, Identifiable {
    let id: String
    let name: String?
    let url: String
    let hostname: String
    let profile: String
    let imageUrl: String?
    let status: ProductStatus
    let currentPrice: Double?
    let previousPrice: Double?
    let currency: String?
    let targetPrice: Double?
    let inStock: Bool?
    let notificationsEnabled: Bool
    let lastCheckedAt: String?
    let lastSuccessfulCheckAt: String?
    let lastError: ApiErrorInfo?
    let createdAt: String
}

struct Pagination: Codable {
    let page: Int
    let limit: Int
    let total: Int
    let totalPages: Int
}

struct ProductListResponse: Codable {
    let items: [ProductListItem]
    let pagination: Pagination
}

struct PriceHistoryPoint: Codable, Identifiable {
    var id: String { observedAt }
    let price: Double
    let currency: String
    let observedAt: String
}

struct StockHistoryPoint: Codable {
    let inStock: Bool
    let observedAt: String
}

struct ProductEvent: Codable, Identifiable {
    var id: String { createdAt + type }
    let type: String
    let code: String?
    let message: String
    let createdAt: String
}

struct ProductDetail: Codable, Identifiable {
    let id: String
    let name: String?
    let url: String
    let hostname: String
    let profile: String
    let imageUrl: String?
    let status: ProductStatus
    let currentPrice: Double?
    let previousPrice: Double?
    let currency: String?
    let targetPrice: Double?
    let inStock: Bool?
    let notificationsEnabled: Bool
    let lastCheckedAt: String?
    let lastSuccessfulCheckAt: String?
    let lastError: ApiErrorInfo?
    let createdAt: String
    let watchId: String?
    let fetchMode: String?
    let priceHistory: [PriceHistoryPoint]
    let stockHistory: [StockHistoryPoint]
    let recentEvents: [ProductEvent]
}

struct CreateProductRequest: Codable {
    let url: String
    let targetPrice: Double?
    let notificationsEnabled: Bool
}

struct UpdateProductRequest: Codable {
    let targetPrice: Double??
    let notificationsEnabled: Bool?
    let status: ProductStatus?

    enum CodingKeys: String, CodingKey {
        case targetPrice, notificationsEnabled, status
    }

    init(targetPrice: Double?? = nil, notificationsEnabled: Bool? = nil, status: ProductStatus? = nil) {
        self.targetPrice = targetPrice
        self.notificationsEnabled = notificationsEnabled
        self.status = status
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        if let targetPrice { try container.encode(targetPrice, forKey: .targetPrice) }
        try container.encodeIfPresent(notificationsEnabled, forKey: .notificationsEnabled)
        try container.encodeIfPresent(status, forKey: .status)
    }
}

struct CheckAcceptedResponse: Codable {
    let accepted: Bool
    let triggeredAt: String
}

struct ApiErrorBody: Codable {
    let code: String
    let message: String
    let requestId: String?
}
