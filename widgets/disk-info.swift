import Foundation
let url = URL(fileURLWithPath: "/")
let keys: Set<URLResourceKey> = [
  .volumeTotalCapacityKey,
  .volumeAvailableCapacityKey,
  .volumeAvailableCapacityForImportantUsageKey
]
guard let v = try? url.resourceValues(forKeys: keys),
      let total = v.volumeTotalCapacity,
      let avail = v.volumeAvailableCapacity,
      let important = v.volumeAvailableCapacityForImportantUsage else {
  print("0|0|0|0"); exit(0)
}
let used = total - Int(important)
let purgeable = max(0, Int(important) - avail)
print("\(total)|\(used)|\(avail)|\(purgeable)")
