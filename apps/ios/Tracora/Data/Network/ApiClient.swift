import Foundation

/// Minimal `URLSession` + `Codable` client — mirrors the shape of
/// `apps/android/.../data/network/ApiClient.kt` (Retrofit) without adding a third-party
/// dependency, matching the "no unnecessary abstraction" convention used elsewhere in the repo.
final class ApiClient {
    private let baseURL: URL
    private let session: URLSession
    private let tokenProvider: () async -> String?
    private let onUnauthenticated: () async -> Void

    private let decoder: JSONDecoder = {
        let decoder = JSONDecoder()
        return decoder
    }()

    private let encoder = JSONEncoder()

    init(baseURL: URL, tokenProvider: @escaping () async -> String?, onUnauthenticated: @escaping () async -> Void) {
        self.baseURL = baseURL
        self.session = URLSession(configuration: .default)
        self.tokenProvider = tokenProvider
        self.onUnauthenticated = onUnauthenticated
    }

    func send<Res: Decodable>(_ endpoint: Endpoint) async throws -> Res {
        try await send(endpoint, body: Optional<Empty>.none)
    }

    func send<Req: Encodable, Res: Decodable>(_ endpoint: Endpoint, body: Req?) async throws -> Res {
        let data = try await sendRaw(endpoint, body: body)
        do {
            return try decoder.decode(Res.self, from: data)
        } catch {
            throw ApiException.network(error)
        }
    }

    func sendNoContent<Req: Encodable>(_ endpoint: Endpoint, body: Req?) async throws {
        _ = try await sendRaw(endpoint, body: body)
    }

    func sendNoContent() async throws {}

    private func sendRaw<Req: Encodable>(_ endpoint: Endpoint, body: Req?) async throws -> Data {
        var components = URLComponents(url: baseURL.appendingPathComponent(endpoint.path), resolvingAgainstBaseURL: false)
        if !endpoint.query.isEmpty { components?.queryItems = endpoint.query }
        guard let url = components?.url else {
            throw ApiException(status: -1, body: ApiErrorBody(code: "INVALID_REQUEST", message: "Invalid URL", requestId: nil))
        }

        var request = URLRequest(url: url)
        request.httpMethod = endpoint.method.rawValue
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        if let token = await tokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }

        if let body {
            request.httpBody = try encoder.encode(body)
        }

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw ApiException.network(error)
        }

        guard let http = response as? HTTPURLResponse else {
            throw ApiException.network(URLError(.badServerResponse))
        }

        if http.statusCode == 204 {
            return Data()
        }

        guard (200...299).contains(http.statusCode) else {
            let body = try? decoder.decode(ApiErrorBody.self, from: data)
            if http.statusCode == 401 {
                await onUnauthenticated()
            }
            throw ApiException(status: http.statusCode, body: body)
        }

        return data
    }
}

/// Placeholder encodable body for GET-style requests that take no payload.
private struct Empty: Encodable {}
