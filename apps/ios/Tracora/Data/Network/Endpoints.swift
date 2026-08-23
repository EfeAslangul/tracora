import Foundation

enum HTTPMethod: String {
    case get = "GET"
    case post = "POST"
    case patch = "PATCH"
    case delete = "DELETE"
}

struct Endpoint {
    let method: HTTPMethod
    let path: String
    let query: [URLQueryItem]

    init(method: HTTPMethod, path: String, query: [URLQueryItem] = []) {
        self.method = method
        self.path = path
        self.query = query
    }

    static func getProducts() -> Endpoint { Endpoint(method: .get, path: "products") }
    static func createProduct() -> Endpoint { Endpoint(method: .post, path: "products") }
    static func getProduct(id: String) -> Endpoint { Endpoint(method: .get, path: "products/\(id)") }
    static func updateProduct(id: String) -> Endpoint { Endpoint(method: .patch, path: "products/\(id)") }
    static func deleteProduct(id: String) -> Endpoint { Endpoint(method: .delete, path: "products/\(id)") }
    static func checkProduct(id: String) -> Endpoint { Endpoint(method: .post, path: "products/\(id)/check") }
    static func retryProduct(id: String) -> Endpoint { Endpoint(method: .post, path: "products/\(id)/retry") }
    static func getSetupStatus() -> Endpoint { Endpoint(method: .get, path: "setup/status") }
    static func postSetup() -> Endpoint { Endpoint(method: .post, path: "setup") }
    static func getMe() -> Endpoint { Endpoint(method: .get, path: "me") }
    static func deleteMe() -> Endpoint { Endpoint(method: .delete, path: "me") }
}
