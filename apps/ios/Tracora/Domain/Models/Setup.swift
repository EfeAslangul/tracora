import Foundation

struct TelegramStatus: Codable {
    let configured: Bool
    let status: String?
}

struct SetupStatus: Codable {
    let required: Bool
    let completedAt: String?
    let defaultCheckIntervalSeconds: Int
    let telegram: TelegramStatus
}

struct SetupProductInput: Codable {
    let url: String
    let targetPrice: Double?
    let notificationsEnabled: Bool
}

struct SetupRequest: Codable {
    let products: [SetupProductInput]
}

struct SetupCreatedItem: Codable, Identifiable {
    var id: String { url }
    let url: String
    let status: ProductStatus
}

struct SetupFailedItem: Codable, Identifiable {
    var id: String { url }
    let url: String
    let code: String
    let message: String
}

struct SetupResult: Codable {
    let completed: Bool
    let completedAt: String?
    let created: [SetupCreatedItem]
    let failed: [SetupFailedItem]
}
