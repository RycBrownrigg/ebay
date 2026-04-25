import SwiftUI

struct HealthView: View {
    @State private var state: ViewState = .idle
    private let client = APIClient()

    enum ViewState {
        case idle
        case loading
        case loaded(HealthResponse)
        case failed(String)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("eBay Seller")
                .font(.title)
                .bold()
            Text("M0 skeleton — backend health probe.")
                .font(.callout)
                .foregroundStyle(.secondary)

            statusCard
                .padding()
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(.background, in: .rect(cornerRadius: 8))
                .overlay(
                    RoundedRectangle(cornerRadius: 8)
                        .stroke(.secondary.opacity(0.3))
                )

            Spacer()
        }
        .padding()
        .task { await load() }
    }

    @ViewBuilder
    private var statusCard: some View {
        switch state {
        case .idle, .loading:
            Text("checking…")
        case .loaded(let h):
            VStack(alignment: .leading, spacing: 6) {
                LabeledContent("status", value: h.status)
                LabeledContent("service", value: h.service)
                LabeledContent("version", value: h.version)
                LabeledContent("uptime", value: String(format: "%.2fs", h.uptimeSeconds))
            }
        case .failed(let message):
            Text("backend unreachable: \(message)")
                .foregroundStyle(.red)
        }
    }

    private func load() async {
        state = .loading
        do {
            let h = try await client.health()
            state = .loaded(h)
        } catch let error as APIError {
            state = .failed(error.localizedDescription)
        } catch {
            state = .failed(error.localizedDescription)
        }
    }
}

#Preview {
    HealthView()
}
