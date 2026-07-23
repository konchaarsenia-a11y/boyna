import Foundation

/// Stub for future Live Activity / local notifications (Dynamic Island).
/// Wire to JS `window.BoinyaNative` via a Capacitor plugin when ready.
/// See NATIVE.md § Live Activity.
enum BoinyaNativeStub {
    static func notify(title: String, body: String) {
        #if DEBUG
        print("[BoinyaNativeStub.notify] \(title): \(body)")
        #endif
    }

    static func startLiveActivity(payload: [String: Any]) {
        #if DEBUG
        print("[BoinyaNativeStub.startLiveActivity] \(payload)")
        #endif
    }

    static func updateLiveActivity(payload: [String: Any]) {
        #if DEBUG
        print("[BoinyaNativeStub.updateLiveActivity] \(payload)")
        #endif
    }

    static func endLiveActivity(payload: [String: Any]) {
        #if DEBUG
        print("[BoinyaNativeStub.endLiveActivity] \(payload)")
        #endif
    }
}
