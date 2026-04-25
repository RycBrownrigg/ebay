import Foundation

enum APIError: Error, LocalizedError {
    case http(Int)
    case decoding(Error)
    case transport(Error)

    var errorDescription: String? {
        switch self {
        case .http(let code): return "HTTP \(code)"
        case .decoding(let err): return "decoding failed: \(err.localizedDescription)"
        case .transport(let err): return err.localizedDescription
        }
    }
}

struct APIClient {
    let baseURL: URL
    let session: URLSession

    init(
        baseURL: URL = URL(string: "http://localhost:3001")!,
        session: URLSession = .shared
    ) {
        self.baseURL = baseURL
        self.session = session
    }

    func health() async throws -> HealthResponse {
        let url = baseURL.appendingPathComponent("api/health")

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(from: url)
        } catch {
            throw APIError.transport(error)
        }

        if let http = response as? HTTPURLResponse, !(200..<300).contains(http.statusCode) {
            throw APIError.http(http.statusCode)
        }

        do {
            return try JSONDecoder().decode(HealthResponse.self, from: data)
        } catch {
            throw APIError.decoding(error)
        }
    }
}
