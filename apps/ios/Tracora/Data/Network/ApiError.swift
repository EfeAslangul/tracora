import Foundation

struct ApiException: Error {
    let status: Int
    let body: ApiErrorBody?

    var code: String { body?.code ?? "UNKNOWN" }
    var message: String { body?.message ?? "Beklenmeyen bir hata oluştu." }

    static func network(_ underlying: Error) -> ApiException {
        ApiException(status: -1, body: ApiErrorBody(code: "NETWORK_ERROR", message: underlying.localizedDescription, requestId: nil))
    }
}
