import Foundation

/// Mirrors the Zod `HealthResponseSchema` in `shared/src/health.ts`.
/// Field names match the JSON keys exactly (no snake_case conversion needed).
struct HealthResponse: Codable, Equatable, Sendable {
    let status: String
    let service: String
    let version: String
    let uptimeSeconds: Double
    let timestamp: String
}
