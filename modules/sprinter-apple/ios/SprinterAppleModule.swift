import ExpoModulesCore
import HealthKit
import ActivityKit
import Foundation

private func failure(_ text: String) -> NSError {
  NSError(domain: "SprinterHealth", code: 1, userInfo: [NSLocalizedDescriptionKey: text])
}
private struct PauseInterval: Codable, Sendable { let from: Double; let to: Double }
private struct WorkoutInput: Codable, Sendable {
  let runId: String; let syncId: String; let startedAt: Double; let endedAt: Double
  let activeSeconds: Double; let totalSeconds: Double; let distanceMeters: Double; let pauses: [PauseInterval]
}
private struct WriteResult: Codable, Sendable { let uuid: String; let alreadyExists: Bool }
private func json<T: Encodable>(_ value: T) throws -> String { String(decoding: try JSONEncoder().encode(value), as: UTF8.self) }
private func step(_ operation: (@escaping (Bool, Error?) -> Void) -> Void) async throws {
  try await withCheckedThrowingContinuation { (continuation: CheckedContinuation<Void, Error>) in
    operation { ok, error in
      if let error { continuation.resume(throwing: error) }
      else if ok { continuation.resume() }
      else { continuation.resume(throwing: failure("L’opération Santé n’a pas été confirmée.")) }
    }
  }
}
private actor HealthWriter {
  let store: HKHealthStore
  private var pending: [String: Task<WriteResult, Error>] = [:]
  init(store: HKHealthStore) { self.store = store }
  func write(_ input: WorkoutInput) async throws -> WriteResult {
    if let task = pending[input.syncId] { return try await task.value }
    let task = Task { try await self.perform(input) }; pending[input.syncId] = task
    defer { pending.removeValue(forKey: input.syncId) }
    return try await task.value
  }
  private func perform(_ p: WorkoutInput) async throws -> WriteResult {
    let workoutType = HKObjectType.workoutType()
    let distanceType = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning)!
    guard HKHealthStore.isHealthDataAvailable(), store.authorizationStatus(for: workoutType) == .sharingAuthorized,
      store.authorizationStatus(for: distanceType) == .sharingAuthorized else { throw failure("Autorisez l’écriture des entraînements et des distances dans Santé.") }
    guard p.runId.count > 0, p.runId.count <= 200, p.syncId == "sprinter.run.v1.\(p.runId)", p.pauses.count <= 10000,
      [p.startedAt, p.endedAt, p.activeSeconds, p.totalSeconds, p.distanceMeters].allSatisfy({ $0.isFinite }),
      p.activeSeconds > 0, p.totalSeconds >= p.activeSeconds, p.distanceMeters > 0,
      p.distanceMeters <= 200000, p.totalSeconds <= 259200, p.endedAt >= p.startedAt,
      abs((p.endedAt - p.startedAt) / 1000 - p.totalSeconds) <= 2 else { throw failure("Chronologie ou mesures de la course incompatibles avec un export Santé fiable.") }
    var previous = 0.0; var paused = 0.0
    for pause in p.pauses {
      guard pause.from.isFinite, pause.to.isFinite, pause.from >= previous, pause.to >= pause.from, pause.to <= p.totalSeconds + 0.001 else { throw failure("Journal des pauses incohérent.") }
      paused += pause.to - pause.from; previous = pause.to
    }
    guard abs(p.totalSeconds - paused - p.activeSeconds) <= 0.05 else { throw failure("Les pauses enregistrées ne permettent pas de conserver le temps actif dans Santé.") }
    let existing: HKWorkout? = try await withCheckedThrowingContinuation { continuation in
      let predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [
        HKQuery.predicateForObjects(withMetadataKey: HKMetadataKeySyncIdentifier, allowedValues: [p.syncId]),
        HKQuery.predicateForObjects(from: HKSource.default())
      ])
      let query = HKSampleQuery(sampleType: workoutType, predicate: predicate, limit: 1, sortDescriptors: nil) { _, samples, error in
        if let error { continuation.resume(throwing: error) } else { continuation.resume(returning: samples?.first as? HKWorkout) }
      }
      store.execute(query)
    }
    if let existing { return WriteResult(uuid: existing.uuid.uuidString.lowercased(), alreadyExists: true) }
    let start = Date(timeIntervalSince1970: p.startedAt / 1000)
    let end = start.addingTimeInterval(p.totalSeconds)
    let config = HKWorkoutConfiguration(); config.activityType = .running; config.locationType = .outdoor
    let builder = HKWorkoutBuilder(healthStore: store, configuration: config, device: HKDevice.local())
    do {
      try await step { builder.beginCollection(withStart: start, completion: $0) }
      try await step { builder.addMetadata([
        HKMetadataKeySyncIdentifier: p.syncId, HKMetadataKeySyncVersion: 1,
        "SprinterActivityID": p.runId, "SprinterActiveSeconds": p.activeSeconds,
        "SprinterTotalSeconds": p.totalSeconds
      ], completion: $0) }
      let distance = HKQuantitySample(type: distanceType, quantity: HKQuantity(unit: .meter(), doubleValue: p.distanceMeters), start: start, end: end,
        metadata: [HKMetadataKeySyncIdentifier: "\(p.syncId).distance", HKMetadataKeySyncVersion: 1])
      try await step { builder.add([distance], completion: $0) }
      var events: [HKWorkoutEvent] = []
      for pause in p.pauses where pause.to > pause.from {
        events.append(HKWorkoutEvent(type: .pause, dateInterval: DateInterval(start: start.addingTimeInterval(pause.from), duration: 0), metadata: nil))
        if pause.to < p.totalSeconds { events.append(HKWorkoutEvent(type: .resume, dateInterval: DateInterval(start: start.addingTimeInterval(pause.to), duration: 0), metadata: nil)) }
      }
      if !events.isEmpty { try await step { builder.addWorkoutEvents(events, completion: $0) } }
      try await step { builder.endCollection(withEnd: end, completion: $0) }
      guard abs(builder.elapsedTime(at: end) - p.activeSeconds) <= 0.1 else { throw failure("Santé ne restitue pas le temps actif attendu. Enregistrement annulé.") }
      let workout: HKWorkout = try await withCheckedThrowingContinuation { continuation in
        builder.finishWorkout { workout, error in
          if let error { continuation.resume(throwing: error) }
          else if let workout { continuation.resume(returning: workout) }
          else { continuation.resume(throwing: failure("Santé n’a pas confirmé l’enregistrement.")) }
        }
      }
      return WriteResult(uuid: workout.uuid.uuidString.lowercased(), alreadyExists: false)
    } catch { builder.discardWorkout(); throw error }
  }
}
public final class SprinterAppleModule: Module {
  private let health = HKHealthStore()
  private lazy var writer = HealthWriter(store: health)
  private var backupProtected = false
  private func status() -> [String: Any] {
    func permission(_ type: HKObjectType) -> String {
      switch health.authorizationStatus(for: type) {
      case .sharingAuthorized: return "authorized"
      case .sharingDenied: return "denied"
      default: return "notDetermined"
      }
    }
    let available = HKHealthStore.isHealthDataAvailable()
    return ["available": available,
      "workoutWrite": available ? permission(HKObjectType.workoutType()) : "notDetermined",
      "distanceWrite": available ? permission(HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning)!) : "notDetermined",
      "liveAllowed": ActivityAuthorizationInfo().areActivitiesEnabled, "backupProtected": backupProtected]
  }
  public func definition() -> ModuleDefinition {
    Name("SprinterApple")
    Function("capabilities") { self.status() }
    AsyncFunction("prepareStorage") { (sqliteDirectory: String) in
      let fileManager = FileManager.default
      let home = URL(fileURLWithPath: NSHomeDirectory()).resolvingSymlinksInPath().path
      let supplied: URL
      if sqliteDirectory.hasPrefix("file:") {
        guard let url = URL(string: sqliteDirectory), url.isFileURL else { throw failure("Emplacement SQLite invalide.") }
        supplied = url
      } else { supplied = URL(fileURLWithPath: sqliteDirectory) }
      let sql = supplied.standardizedFileURL.resolvingSymlinksInPath()
      guard sql.path.hasPrefix(home + "/") else { throw failure("Emplacement de stockage hors du bac à sable.") }
      // All imported records, derived journals and receipts live in the SQLite directory.
      // Do not exclude unrelated Documents/Application Support contents from backup.
      var directories = [sql]
      if let identifier = Bundle.main.object(forInfoDictionaryKey: "ExpoWidgetsAppGroupIdentifier") as? String,
        let group = fileManager.containerURL(forSecurityApplicationGroupIdentifier: identifier) { directories.append(group) }
      for var directory in directories {
        try fileManager.createDirectory(at: directory, withIntermediateDirectories: true)
        var values = URLResourceValues(); values.isExcludedFromBackup = true
        try directory.setResourceValues(values)
      }
      self.backupProtected = true
      return self.status()
    }
    AsyncFunction("requestAuthorization") { (read: Bool, write: Bool) async throws -> [String: Any] in
      guard self.backupProtected, HKHealthStore.isHealthDataAvailable() else { throw failure("Santé ou la protection du stockage est indisponible.") }
      let workout = HKObjectType.workoutType(), distance = HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning)!
      let share: Set<HKSampleType> = write ? [workout, distance] : []
      let reads: Set<HKObjectType> = read ? [workout, distance] : []
      try await step { completion in DispatchQueue.main.async { self.health.requestAuthorization(toShare: share, read: reads, completion: completion) } }
      return self.status() // Reading authorization intentionally has no granted/denied result.
    }
    AsyncFunction("writeWorkout") { (payload: String) async throws -> String in
      guard self.backupProtected else { throw failure("La protection du stockage Santé doit être initialisée.") }
      let input = try JSONDecoder().decode(WorkoutInput.self, from: Data(payload.utf8))
      let result = try await self.writer.write(input)
      return try json(result)
    }
    AsyncFunction("readWorkouts") { (fromMs: Double, toMs: Double, encodedAnchor: String?) async throws -> String in
      guard self.backupProtected, HKHealthStore.isHealthDataAvailable(), fromMs.isFinite, toMs.isFinite, fromMs < toMs,
        toMs <= Date().timeIntervalSince1970 * 1000 + 5000 else { throw failure("Période de lecture Santé invalide.") }
      var anchor: HKQueryAnchor? = nil
      if let encodedAnchor {
        guard encodedAnchor.count <= 32768, let bytes = Data(base64Encoded: encodedAnchor) else { throw failure("Curseur Santé invalide.") }
        anchor = try NSKeyedUnarchiver.unarchivedObject(ofClass: HKQueryAnchor.self, from: bytes)
        guard anchor != nil else { throw failure("Curseur Santé illisible.") }
      }
      return try await withCheckedThrowingContinuation { continuation in
        let predicate = NSCompoundPredicate(andPredicateWithSubpredicates: [HKQuery.predicateForWorkouts(with: .running),
          HKQuery.predicateForSamples(withStart: Date(timeIntervalSince1970: fromMs / 1000), end: Date(timeIntervalSince1970: toMs / 1000), options: .strictStartDate)])
        let query = HKAnchoredObjectQuery(type: HKObjectType.workoutType(), predicate: predicate, anchor: anchor, limit: 50) { _, samples, deleted, nextAnchor, error in
          if let error { continuation.resume(throwing: error); return }
          do {
            let workouts: [[String: Any]] = (samples ?? []).compactMap { sample in
              guard let workout = sample as? HKWorkout else { return nil }
              let source = workout.sourceRevision.source, own = source.bundleIdentifier == Bundle.main.bundleIdentifier
              let distance = workout.statistics(for: HKObjectType.quantityType(forIdentifier: .distanceWalkingRunning)!)?.sumQuantity()?.doubleValue(for: .meter()) ?? workout.totalDistance?.doubleValue(for: .meter())
              return ["uuid": workout.uuid.uuidString.lowercased(), "startedAt": workout.startDate.timeIntervalSince1970 * 1000,
                "endedAt": workout.endDate.timeIntervalSince1970 * 1000, "activeSeconds": workout.duration, "distanceMeters": distance as Any? ?? NSNull(),
                "sourceName": source.name, "sourceBundle": source.bundleIdentifier, "ownSource": own,
                "originalRunId": (own ? workout.metadata?["SprinterActivityID"] as? String : nil) as Any? ?? NSNull()]
            }
            let next = try nextAnchor.map { try NSKeyedArchiver.archivedData(withRootObject: $0, requiringSecureCoding: true).base64EncodedString() }
            let payload: [String: Any] = ["workouts": workouts, "deleted": (deleted ?? []).map { $0.uuid.uuidString.lowercased() }, "anchor": next as Any? ?? NSNull(), "hasMore": (samples?.count ?? 0) >= 50]
            continuation.resume(returning: String(decoding: try JSONSerialization.data(withJSONObject: payload), as: UTF8.self))
          } catch { continuation.resume(throwing: error) }
        }
        self.health.execute(query)
      }
    }
  }
}
