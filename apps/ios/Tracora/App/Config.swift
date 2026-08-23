import Foundation

/// API base URL resolution. Mirrors Android's `-PlanApiHost` override pattern: the Simulator
/// reaches the host machine directly via `127.0.0.1` (no NAT translation like the Android
/// emulator's `10.0.2.2`), so that's the default. Override by setting `API_BASE_URL` in the
/// scheme's environment variables (Product > Scheme > Edit Scheme > Run > Arguments) when testing
/// against a LAN IP on a physical device.
enum Config {
    static var apiBaseURL: URL {
        if let override = ProcessInfo.processInfo.environment["API_BASE_URL"],
           let url = URL(string: override) {
            return url
        }
        if let plistValue = Bundle.main.object(forInfoDictionaryKey: "API_BASE_URL") as? String,
           !plistValue.isEmpty,
           let url = URL(string: plistValue) {
            return url
        }
        return URL(string: "http://127.0.0.1:3000/api/v1")!
    }
}
