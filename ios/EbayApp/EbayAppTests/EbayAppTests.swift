import Foundation
import Testing
@testable import EbayApp

@Suite("HealthResponse decoding")
struct HealthResponseTests {

    @Test func decodesValidPayload() throws {
        let json = Data("""
        {
            "status": "ok",
            "service": "ebay-api",
            "version": "0.0.0",
            "uptimeSeconds": 12.34,
            "timestamp": "2026-04-25T20:00:00.000Z"
        }
        """.utf8)

        let decoded = try JSONDecoder().decode(HealthResponse.self, from: json)
        #expect(decoded.status == "ok")
        #expect(decoded.service == "ebay-api")
        #expect(decoded.version == "0.0.0")
        #expect(decoded.uptimeSeconds == 12.34)
        #expect(decoded.timestamp == "2026-04-25T20:00:00.000Z")
    }

    @Test func rejectsMissingFields() {
        let json = Data(#"{ "status": "ok" }"#.utf8)
        #expect(throws: DecodingError.self) {
            try JSONDecoder().decode(HealthResponse.self, from: json)
        }
    }

    @Test func rejectsWrongFieldType() {
        let json = Data("""
        {
            "status": "ok",
            "service": "ebay-api",
            "version": "0.0.0",
            "uptimeSeconds": "not a number",
            "timestamp": "2026-04-25T20:00:00.000Z"
        }
        """.utf8)
        #expect(throws: DecodingError.self) {
            try JSONDecoder().decode(HealthResponse.self, from: json)
        }
    }
}
