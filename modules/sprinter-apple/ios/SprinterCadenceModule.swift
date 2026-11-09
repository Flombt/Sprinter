import ExpoModulesCore
import CoreMotion
import Foundation

public final class SprinterCadenceModule: Module {
  private let pedometer = CMPedometer()
  private var generation = 0
  private func status() -> [String: Any] {
    let permission: String
    switch CMPedometer.authorizationStatus() {
    case .authorized: permission = "authorized"
    case .denied, .restricted: permission = "denied"
    default: permission = "notDetermined"
    }
    return ["available": CMPedometer.isCadenceAvailable(), "permission": permission]
  }
  public func definition() -> ModuleDefinition {
    Name("SprinterCadence")
    Events("onCadence")
    Function("capabilities") { self.status() }
    AsyncFunction("requestAuthorization") { (promise: Promise) in
      guard CMPedometer.isCadenceAvailable() else { promise.resolve(self.status()); return }
      let now = Date()
      self.pedometer.queryPedometerData(from: now.addingTimeInterval(-1), to: now) { _, _ in
        DispatchQueue.main.async { promise.resolve(self.status()) }
      }
    }.runOnQueue(.main)
    AsyncFunction("start") { () throws in
      guard CMPedometer.isCadenceAvailable(), CMPedometer.authorizationStatus() == .authorized else {
        throw NSError(domain: "SprinterCadence", code: 1, userInfo: [NSLocalizedDescriptionKey: "Cadence non disponible ou mouvements non autorisés."])
      }
      self.generation += 1; let generation = self.generation
      self.pedometer.stopUpdates()
      self.pedometer.startUpdates(from: Date()) { data, error in
        DispatchQueue.main.async {
          guard generation == self.generation else { return }
          guard error == nil, let data, let cadence = data.currentCadence?.doubleValue, cadence.isFinite, cadence > 0 else {
            self.sendEvent("onCadence", ["spm": NSNull(), "timestamp": Date().timeIntervalSince1970 * 1000]); return
          }
          self.sendEvent("onCadence", ["spm": cadence * 60, "timestamp": data.endDate.timeIntervalSince1970 * 1000])
        }
      }
    }.runOnQueue(.main)
    AsyncFunction("stop") { self.generation += 1; self.pedometer.stopUpdates() }.runOnQueue(.main)
    OnDestroy { self.generation += 1; self.pedometer.stopUpdates() }
  }
}
