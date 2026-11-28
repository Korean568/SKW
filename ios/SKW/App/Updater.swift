import Compression
import CryptoKit
import Darwin
import Foundation

/// 게임 자동 업데이트 — Android 의 Updater.java 를 그대로 옮긴 것 (PC판 desktop/main.js 와 같은 파일 · 같은 규칙).
///
///  - 모든 주소(bases)에 latest.json 을 동시에 묻고, 그중 가장 높은 버전을 고른다 (한 주소가 실패하거나 옛것을 알려 줘도 나머지를 본다).
///    쓸 수 있는 새 버전을 알려 준 주소가 있으면 나머지는 1초(grace)만 더 기다리고 받기 시작한다.
///  - 이 앱이 띄울 수 있고(minShell ≤ 앱 버전) 지금 게임 · 이미 받아 둔 게임보다 새것일 때만 game.gz 를 받는다 (낮은 버전으로 내려가지 않음).
///  - 풀어서(gzip) sha256 이 맞을 때만 Application Support/game/ 에 저장: game-<버전>.html 을 먼저 쓰고(임시 파일 → rename),
///    마지막에 version.json 을 바꿔 가리키게 한다 → 반쯤 받은 파일이 멀쩡한 게임을 덮지 않는다.
///    켤 때도 version.json 의 sha256 으로 파일을 다시 확인한다 (어긋나면 앱에 든 게임으로 시작).
///  - 확인은 한 번에 하나만 (worker 큐 하나). 네트워크는 URLSession(ephemeral · 캐시 없음), 시간 제한 latest.json 10초 · game.gz 90초,
///    실패하면 1.5초 쉬고 한 번 더 (4xx 는 다시 해도 같으므로 바로 실패 — PC판과 같이). 주소마다 ?t= 를 붙여 캐시를 피한다.
///  - 기록: Application Support/update.log (200줄까지) — 소유자 기기에서 왜 안 되는지 알아보려고.
///  - 게임에 넘기는 상태 S (skwDesktop.update 약속, ios-shim.js):
///      { state: idle|checking|downloading|ready|latest|error, current:{version,label}, latest:{version,label}|null,
///        error: 짧은 이유|null, at: 마지막으로 끝난 확인 시각(ms), applied: 켤 때 새로 받은 게임으로 바꿨는가, seq: 확인 번호, shell }
///
/// UIKit 을 쓰지 않는다 → 시험(SKWTests)이 이 파일을 그대로 컴파일해 가짜 서버(URLProtocol)로 시험한다.
final class Updater {
    static let bases = [
        "https://raw.githubusercontent.com/Korean568/SKW/main/desktop/update/",
        "https://korean568.github.io/SKW/desktop/update/",
    ]
    static let maxJSON = 64 * 1024, maxGz = 16 << 20, maxHTML = 32 << 20 // 게임은 1~2 MB
    static let logLines = 200

    // 시간 (초) — 시험할 때만 줄인다
    var latestTimeout: TimeInterval = 10
    var gameTimeout: TimeInterval = 90
    var backoff: TimeInterval = 1.5
    var grace: TimeInterval = 1.0

    /// 상태가 바뀔 때마다 불린다 (아무 스레드에서나, Updater 의 잠금 안에서 — 금방 끝낼 것). json = S, done = 확인 중이 아님
    typealias Listener = (_ json: String, _ done: Bool) -> Void

    /// 받아 둔 게임 한 벌
    struct Game: Equatable {
        let version: String, label: String, minShell: String, sha256: String
        let file: URL
    }

    /// 주소 하나가 알려 준 latest.json
    struct Manifest: Equatable {
        let base: String, version: String, label: String, file: String, sha256: String, minShell: String
    }

    /// 우리가 정한 짧은 실패 이유 (HTTP 404 · sha256 · minShell …)
    struct Fail: Error, Equatable, CustomStringConvertible {
        let code: String
        init(_ code: String) { self.code = code }
        var description: String { code }
    }

    let dir: URL, gameDir: URL, logFile: URL
    let shell: String, bundledVersion: String, bundledLabel: String
    private let bases: [String]
    private let listener: Listener?
    private let session: URLSession
    private let fetcher: Fetcher
    private let worker = DispatchQueue(label: "skw-update", qos: .utility)
    private let net = DispatchQueue(label: "skw-update-net", qos: .utility, attributes: .concurrent)
    private let lock = NSRecursiveLock(), logLock = NSLock(), sleeper = NSCondition()

    // 아래는 모두 lock 으로 보호
    private var currentGame: Game?   // 지금 띄우는 받은 게임 (nil = 앱에 든 게임)
    private var ready: Game?         // 받아서 확인했고 apply() 나 다음 시작 때 쓸 게임
    private var state = "idle", error: String?, latestVersion: String?, latestLabel: String?
    private var at: Int64 = 0
    private var seq = 0
    private var applied = false, busyFlag = false, closed = false
    private var logBuf: [String]?    // logLock 으로 보호

    /// dataDir = Application Support (앱 전용). configuration 은 시험에서 가짜 서버(protocolClasses)를 넣을 때만.
    init(dataDir: URL, bases: [String] = Updater.bases, shell: String, bundledVersion: String, bundledLabel: String?,
         configuration: URLSessionConfiguration = .ephemeral, listener: Listener?) {
        dir = dataDir
        gameDir = dataDir.appendingPathComponent("game", isDirectory: true)
        logFile = dataDir.appendingPathComponent("update.log")
        self.bases = bases
        self.shell = shell
        self.bundledVersion = bundledVersion
        self.bundledLabel = bundledLabel ?? ""
        self.listener = listener
        let c = configuration
        c.requestCachePolicy = .reloadIgnoringLocalAndRemoteCacheData
        c.urlCache = nil
        c.waitsForConnectivity = false // 연결이 없으면 기다리지 않고 바로 실패 (offline)
        c.httpShouldSetCookies = false
        c.httpCookieAcceptPolicy = .never
        c.httpAdditionalHeaders = ["Cache-Control": "no-cache"]
        let q = OperationQueue()
        q.maxConcurrentOperationCount = 1
        let fe = Fetcher()
        fetcher = fe
        session = URLSession(configuration: c, delegate: fe, delegateQueue: q)
        try? FileManager.default.createDirectory(at: dataDir, withIntermediateDirectories: true)
    }

    /* ───────────────────────── 버전 ───────────────────────── */

    private static func vnum(_ v: String) -> [Int] {
        v.split(separator: ".", omittingEmptySubsequences: false).map { p -> Int in
            var x = 0, k = 0
            for c in p.utf8 {
                guard k < 9, c >= 48, c <= 57 else { break }
                x = x * 10 + Int(c - 48)
                k += 1
            }
            return x
        }
    }

    /// 1.6.0 꼴 비교 (빈 자리 = 0): a > b 면 양수
    static func compare(_ a: String, _ b: String) -> Int {
        let x = vnum(a), y = vnum(b)
        for i in 0..<max(x.count, y.count) {
            let p = i < x.count ? x[i] : 0, q = i < y.count ? y[i] : 0
            if p != q { return p > q ? 1 : -1 }
        }
        return 0
    }

    static func newer(_ a: String, _ b: String) -> Bool { compare(a, b) > 0 }

    /// 글자 전체가 pattern 과 맞는가 (Java 의 Matcher.matches() 와 같게). ^…$ 는 쓰지 않는다: ICU 의 $ 는 끝의 줄바꿈 앞에서도 맞아
    /// "0.17\n" 같은 값이 통과하기 때문 → \A(?:…)\z 로 감싼다
    static func matches(_ pattern: String, _ s: String) -> Bool {
        s.range(of: "\\A(?:" + pattern + ")\\z", options: .regularExpression) != nil
    }

    static func cleanVersion(_ v: Any?) -> String? {
        guard let s = v as? String, matches("[0-9]{1,6}(\\.[0-9]{1,6}){0,3}", s) else { return nil }
        return s
    }

    static func cleanLabel(_ v: Any?) -> String {
        guard let s = v as? String, matches("[0-9A-Za-z.+-]{1,24}", s) else { return "" }
        return s
    }

    static func cleanSha(_ v: Any?) -> String? {
        guard let s = (v as? String)?.lowercased(), matches("[0-9a-f]{64}", s) else { return nil }
        return s
    }

    static func isFileName(_ s: String) -> Bool { matches("[A-Za-z0-9][A-Za-z0-9._-]{0,63}", s) }

    /* ───────────────────────── 지금 게임 · 받아 둔 게임 ───────────────────────── */

    /// 지금 띄울 받은 게임 (nil = 앱에 든 게임)
    func current() -> Game? {
        lock.lock(); defer { lock.unlock() }
        return currentGame
    }

    /// Application Support/game 의 게임: 앱에 든 것보다 새것 · 이 앱이 띄울 수 있음(minShell) · 내용이 sha256 과 같을 때만. 아니면 nil.
    func stored() -> Game? {
        let vf = gameDir.appendingPathComponent("version.json")
        guard FileManager.default.fileExists(atPath: vf.path) else { return nil }
        do {
            let m = try Self.jsonObject(Self.readFile(vf, max: Self.maxJSON))
            guard let v = Self.cleanVersion(m["version"]), let sha = Self.cleanSha(m["sha256"]),
                  let f = m["file"] as? String, Self.isFileName(f) else { throw Fail("version.json") }
            let ms = Self.cleanVersion(m["minShell"])
            if !Self.newer(v, bundledVersion) { return nil } // 앱을 새로 설치해 앱에 든 게임이 같거나 더 새것
            if let ms, Self.newer(ms, shell) { throw Fail("minShell \(ms)") }
            let hf = gameDir.appendingPathComponent(f)
            guard FileManager.default.fileExists(atPath: hf.path) else { throw Fail("파일 없음") }
            guard sha == Self.hex(Self.sha256(try Self.readFile(hf, max: Self.maxHTML))) else { throw Fail("sha256") }
            return Game(version: v, label: Self.cleanLabel(m["label"]), minShell: ms ?? "0", sha256: sha, file: hf)
        } catch {
            log("받아 둔 게임을 쓰지 않음: \(Self.reason(error))")
            return nil
        }
    }

    /// 켤 때 (게임을 띄우기 전): 받아 둔 게임이 앱에 든 것보다 새것이면 그걸 띄운다. 안 쓰는 파일은 지운다.
    func useCached() {
        let g = stored()
        if let fs = try? FileManager.default.contentsOfDirectory(at: gameDir, includingPropertiesForKeys: nil) {
            for f in fs {
                if let g, f.lastPathComponent == g.file.lastPathComponent || f.lastPathComponent == "version.json" { continue }
                do { try FileManager.default.removeItem(at: f) } catch { log("지우지 못함: \(f.lastPathComponent)") }
            }
        }
        let first = g.map { announce($0.version) } ?? false
        lock.lock()
        if let g {
            currentGame = g
            ready = nil
            applied = first
        }
        lock.unlock()
        log("켬: 앱 \(shell) · 게임 " + (g.map { "\($0.version) (받은 것" + (first ? ", 처음" : "") + ")" } ?? "\(bundledVersion) (앱에 든 것)"))
    }

    /// 이 버전을 처음 띄우는가 (그러면 게임이 "새 버전으로 업데이트했습니다" 를 보여 준다)
    private func announce(_ v: String) -> Bool {
        let f = dir.appendingPathComponent("update-seen")
        if let d = try? Self.readFile(f, max: 64), String(decoding: d, as: UTF8.self).trimmingCharacters(in: .whitespacesAndNewlines) == v {
            return false
        }
        try? Self.writeAtomic(f, Data(v.utf8)) // 실패하면 다음에 한 번 더 알려 줄 뿐
        return true
    }

    /// 준비된(ready) 게임으로 바꾼다. 페이지를 다시 불러오는 것은 부른 쪽 (켜기 전이면 그대로 시작). false = 준비된 게임 없음
    func apply() -> Bool {
        lock.lock()
        let can = !closed && ready != nil && state == "ready"
        lock.unlock()
        if !can { return false }
        let g = stored() // 파일이 그대로인지 다시 확인 (sha256)
        lock.lock()
        let ok = g != nil && ready != nil && state == "ready" && g?.version == ready?.version
        if ok, let g {
            currentGame = g
            ready = nil
            state = "latest"
            error = nil
            applied = true
            latestVersion = g.version
            latestLabel = g.label
        } else if ready != nil && state == "ready" {
            ready = nil
            state = "error"
            error = "sha256"
        }
        notifyStatus(true)
        lock.unlock()
        if ok, let g { _ = announce(g.version) }
        log(ok ? "새 게임 \(g?.version ?? "") 으로 바꿈" : "바꾸지 못함: 받아 둔 파일이 없거나 바뀜")
        return ok
    }

    /// 받은 게임 HTML. 못 읽으면 nil → 앱에 든 게임 (그리고 current 를 비운다)
    func gameData(_ g: Game) -> Data? {
        do {
            return try Self.readFile(g.file, max: Self.maxHTML)
        } catch {
            log("받은 게임 \(g.version) 을 읽지 못함 (\(Self.reason(error))) → 앱에 든 게임")
        }
        lock.lock()
        if currentGame == g { currentGame = nil }
        lock.unlock()
        return nil
    }

    /* ───────────────────────── 확인 ───────────────────────── */

    /// 확인을 시작한다. 돌려주는 값 = 이 확인의 번호 (이미 확인 중이면 그 번호, 끝난 뒤(close)라 못 하면 0)
    @discardableResult
    func check(_ why: String) -> Int {
        lock.lock(); defer { lock.unlock() }
        if closed { return 0 }
        if busyFlag { return seq }
        busyFlag = true
        seq += 1
        let id = seq
        state = "checking"
        error = nil
        notifyStatus(false)
        worker.async { self.run(why) }
        return id
    }

    func busy() -> Bool {
        lock.lock(); defer { lock.unlock() }
        return busyFlag
    }

    private var isClosed: Bool {
        lock.lock(); defer { lock.unlock() }
        return closed
    }

    private func run(_ why: String) {
        let t0 = Date()
        do {
            try runCheck(why)
        } catch let e as Fail where e.code == "closed" {
            finish("error", "closed", nil, nil)
        } catch {
            log("오류: \(error)")
            finish("error", "bug", nil, nil)
        }
        lock.lock()
        let s = state + (error.map { " (\($0))" } ?? "") + (latestVersion.map { " · \($0)" } ?? "")
        lock.unlock()
        log("결과: \(s) · \(Int(Date().timeIntervalSince(t0) * 1000))ms")
        lock.lock() // busy 를 풀면서 마지막 상태를 같은 순간에 알린다 (그 사이에 들어온 check() 와 순서가 섞이지 않게)
        busyFlag = false
        at = Self.nowMs()
        notifyStatus(true)
        lock.unlock()
    }

    private func runCheck(_ why: String) throws {
        let cur = current()
        let curV = cur?.version ?? bundledVersion, curL = cur?.label ?? bundledLabel
        log("확인 (\(why)): 지금 게임 \(curV) · 앱 \(shell)")
        lock.lock()
        let have = ready // 확인 중에는 state 가 ready 가 아니라 apply() 가 되지 않는다 → 끝까지 그대로
        lock.unlock()
        let haveV = have.map { Self.newer($0.version, curV) ? $0.version : curV } ?? curV

        // 1) 모든 주소에 동시에 latest.json — 온 순서대로 본다. 쓸 수 있는 새 버전이 오면 나머지는 grace 만 더 기다린다
        //    (한 주소가 말없이 막혀도(학교 와이파이 등) 그 주소의 시간 제한 · 다시 시도(약 21초)를 다 기다리지 않고 받기 시작)
        let inbox = Inbox<(Int, Result<Manifest, Error>)>()
        for (i, b) in bases.enumerated() {
            net.async { inbox.put((i, Result { try self.manifest(b) })) }
        }
        var ans = [Manifest?](repeating: nil, count: bases.count)
        var bad = [String?](repeating: nil, count: bases.count)
        var pending = Set(bases.indices)
        var end = Date().addingTimeInterval(latestTimeout * 2 + backoff + 5)
        var found = false
        while !pending.isEmpty, let item = inbox.poll(until: end, stop: { self.isClosed }) {
            let (i, r) = item
            pending.remove(i)
            let h = Self.host(bases[i])
            switch r {
            case .success(let m):
                ans[i] = m
                log("\(h) latest.json: \(m.version)" + (m.label.isEmpty ? "" : " (\(m.label))") + " · minShell \(m.minShell)")
                if !found && !Self.newer(m.minShell, shell) && Self.newer(m.version, haveV) {
                    found = true
                    end = min(end, Date().addingTimeInterval(grace))
                }
            case .failure(let e):
                bad[i] = Self.reason(e)
                log("\(h) latest.json 실패: \(bad[i] ?? "")")
            }
        }
        if isClosed { throw Fail("closed") }
        for i in pending.sorted() { // 시간 안에 답하지 않은 주소 (그 요청은 제 시간 제한에 끝나고 답은 버린다)
            bad[i] = "timeout"
            log("\(Self.host(bases[i])) latest.json " + (found ? "아직 답이 없음 → 기다리지 않고 받기 시작 (다음 확인 때 다시)" : "실패: timeout"))
        }
        var got = [Manifest]() // 주소 순서대로 (답이 온 순서가 아니라)
        var errs = [String]()
        for i in bases.indices {
            if let m = ans[i] { got.append(m) } else if let b = bad[i], !errs.contains(b) { errs.append(b) }
        }

        // 2) 가장 높은 버전 (이 앱이 띄울 수 있는 것 중) — 같으면 앞의 주소
        var best: Manifest?, blocked: Manifest?
        for m in got {
            if Self.newer(m.minShell, shell) {
                if blocked == nil || Self.newer(m.version, blocked!.version) { blocked = m }
            } else if best == nil || Self.newer(m.version, best!.version) {
                best = m
            }
        }

        if let best, Self.newer(best.version, haveV) {
            // 3) 받기: 그 버전을 알려 준 주소부터, 안 되면 같은 버전 · 같은 sha256 을 알려 준 다른 주소
            lock.lock()
            state = "downloading"
            latestVersion = best.version
            latestLabel = best.label
            notifyStatus(false)
            lock.unlock()
            var from = [best]
            for m in got where m != best && m.version == best.version && m.sha256 == best.sha256 { from.append(m) }
            var err: String?
            for m in from {
                do {
                    let html = try download(m)
                    let g = try save(m, html)
                    log("\(Self.host(m.base)) \(m.file) \(m.version): 받음 \(html.count) B · sha256 맞음 · 저장")
                    finish("ready", nil, g, g)
                    return
                } catch {
                    if isClosed { throw Fail("closed") }
                    err = Self.reason(error)
                    log("\(Self.host(m.base)) \(m.file) \(m.version) 실패: \(err ?? "")")
                }
            }
            if let have, Self.newer(have.version, curV) { finish("ready", nil, have, have) } else { finish("error", err, nil, nil) }
        } else if let have, Self.newer(have.version, curV) {
            finish("ready", nil, have, have) // 전에 받아 둔 것이 아직 가장 새것
        } else if let blocked, Self.newer(blocked.version, curV) {
            log("새 게임 \(blocked.version) 은 앱 \(blocked.minShell) 이상이 필요 (지금 앱 \(shell)) → App Store 에서 앱 업데이트 필요")
            lock.lock()
            latestVersion = blocked.version
            latestLabel = blocked.label
            lock.unlock()
            finish("error", "minShell", nil, nil)
        } else if got.isEmpty {
            finish("error", errs.isEmpty ? "offline" : errs.joined(separator: ", "), nil, nil)
        } else {
            lock.lock()
            latestVersion = curV
            latestLabel = curL
            lock.unlock()
            finish("latest", nil, nil, nil)
        }
    }

    /// 확인 결과를 상태에 넣는다 (ready 면 game = 준비된 게임, show = S.latest 로 보일 게임)
    private func finish(_ st: String, _ err: String?, _ game: Game?, _ show: Game?) {
        lock.lock(); defer { lock.unlock() }
        state = st
        error = err
        if let game { ready = game }
        if let show {
            latestVersion = show.version
            latestLabel = show.label
        }
    }

    private func manifest(_ base: String) throws -> Manifest {
        let b = try getRetry("latest.json", base + "latest.json", latestTimeout, Self.maxJSON)
        let j: [String: Any]
        do { j = try Self.jsonObject(b) } catch { throw Fail("bad json") }
        var f: Any? = j["file"]
        if f == nil || f is NSNull { f = "game.gz" }
        guard let v = Self.cleanVersion(j["version"]), let sha = Self.cleanSha(j["sha256"]),
              let file = f as? String, Self.isFileName(file) else { throw Fail("bad json") }
        return Manifest(base: base, version: v, label: Self.cleanLabel(j["label"]), file: file, sha256: sha,
                        minShell: Self.cleanVersion(j["minShell"]) ?? "0")
    }

    /// game.gz 받기 → 풀기 → sha256 확인
    private func download(_ m: Manifest) throws -> Data {
        let raw = try getRetry(m.file, m.base + m.file, gameTimeout, Self.maxGz)
        let html = try Self.gunzip(raw, max: Self.maxHTML)
        if Self.hex(Self.sha256(html)) != m.sha256 { throw Fail("sha256") }
        return html
    }

    /// game-<버전>.html 을 쓴 뒤 version.json 을 바꿔 가리키게 한다 (둘 다 임시 파일 → rename)
    private func save(_ m: Manifest, _ html: Data) throws -> Game {
        do {
            try FileManager.default.createDirectory(at: gameDir, withIntermediateDirectories: true)
        } catch { throw Fail("disk") }
        var gd = gameDir // 다시 받을 수 있는 파일이라 iCloud · 기기 백업에서 뺀다
        var rv = URLResourceValues()
        rv.isExcludedFromBackup = true
        try? gd.setResourceValues(rv)
        let hf = gameDir.appendingPathComponent("game-\(m.version).html")
        try Self.writeAtomic(hf, html)
        let j: [String: Any] = ["version": m.version, "label": m.label, "minShell": m.minShell, "sha256": m.sha256,
                                "file": hf.lastPathComponent, "size": html.count, "from": Self.host(m.base), "date": Self.stamp()]
        guard let d = try? JSONSerialization.data(withJSONObject: j, options: [.sortedKeys]) else { throw Fail("json") }
        try Self.writeAtomic(gameDir.appendingPathComponent("version.json"), d)
        return Game(version: m.version, label: m.label, minShell: m.minShell, sha256: m.sha256, file: hf)
    }

    /* ───────────────────────── 네트워크 ───────────────────────── */

    /// 한 번 실패하면 잠깐 쉬고 한 번 더 (HTTP 4xx 는 다시 해도 같으므로 바로 실패)
    private func getRetry(_ what: String, _ url: String, _ timeout: TimeInterval, _ max: Int) throws -> Data {
        do {
            return try get(url, timeout, max)
        } catch {
            if let f = error as? Fail, f.code.hasPrefix("HTTP 4") || f.code == "closed" { throw error }
            if isClosed { throw Fail("closed") }
            log("\(Self.host(url)) \(what) 1차 실패 (\(Self.reason(error))) → \(Int(backoff * 1000))ms 뒤 다시")
            try pause(backoff)
            return try get(url, timeout, max)
        }
    }

    /// timeout 안에 끝나지 않으면 요청을 취소한다 (DNS 가 멈춰도 여기서는 timeout + 0.5초 뒤에 돌아온다)
    private func get(_ url: String, _ timeout: TimeInterval, _ max: Int) throws -> Data {
        guard let u = Self.bust(url) else { throw Fail("bad url") }
        var req = URLRequest(url: u, cachePolicy: .reloadIgnoringLocalAndRemoteCacheData, timeoutInterval: timeout)
        req.setValue("no-cache", forHTTPHeaderField: "Cache-Control")
        let f = Fetch(max: max)
        lock.lock()
        if closed {
            lock.unlock()
            throw Fail("closed")
        }
        let task = session.dataTask(with: req)
        fetcher.add(task, f)
        task.resume()
        lock.unlock()
        if f.done.wait(timeout: .now() + timeout + 0.5) == .timedOut {
            task.cancel()
            throw Fail("timeout")
        }
        if let fail = f.fail { throw fail }
        if let e = f.error { throw isClosed ? Fail("closed") : e }
        return f.data
    }

    /// 주소 끝에 ?t=<지금 ms> (CDN · 프록시의 캐시를 피함)
    static func bust(_ url: String) -> URL? {
        URL(string: url + (url.contains("?") ? "&" : "?") + "t=\(nowMs())")
    }

    /// 닫히면(close) 바로 깨는 잠깐 쉬기
    private func pause(_ t: TimeInterval) throws {
        let end = Date().addingTimeInterval(t)
        sleeper.lock()
        while !isClosed && Date() < end { _ = sleeper.wait(until: end) }
        sleeper.unlock()
        if isClosed { throw Fail("closed") }
    }

    /// gzip 이면 풀고, 서버가 이미 풀어서 준 것이면 그대로 (아래 sha256 으로 검증). gzip 머리(RFC 1952)는 직접 읽고
    /// 본문(raw deflate)은 Compression 의 .zlib 로 푼 뒤 꼬리의 CRC32 · 길이를 확인한다.
    static func gunzip(_ raw: Data, max: Int) throws -> Data {
        let b = [UInt8](raw)
        guard b.count >= 2, b[0] == 0x1f, b[1] == 0x8b else { return raw }
        guard b.count >= 18, b[2] == 8 else { throw Fail("gzip") }
        let flg = b[3]
        var i = 10
        if flg & 4 != 0 { // FEXTRA
            guard i + 2 <= b.count else { throw Fail("gzip") }
            i += 2 + (Int(b[i]) | Int(b[i + 1]) << 8)
        }
        for bit: UInt8 in [8, 16] where flg & bit != 0 { // FNAME · FCOMMENT (0 으로 끝남)
            while i < b.count && b[i] != 0 { i += 1 }
            i += 1
        }
        if flg & 2 != 0 { i += 2 } // FHCRC
        guard i <= b.count - 8 else { throw Fail("gzip") }
        let n = b.count
        let crc = UInt32(b[n - 8]) | UInt32(b[n - 7]) << 8 | UInt32(b[n - 6]) << 16 | UInt32(b[n - 5]) << 24
        let size = UInt32(b[n - 4]) | UInt32(b[n - 3]) << 8 | UInt32(b[n - 2]) << 16 | UInt32(b[n - 1]) << 24
        var out = Data()
        do {
            let filter = try OutputFilter(.decompress, using: .zlib) { chunk in
                if let chunk {
                    out.append(chunk)
                    if out.count > max { throw Fail("size") }
                }
            }
            try filter.write(Data(b[i..<(n - 8)]))
            try filter.finalize()
        } catch let e as Fail {
            throw e
        } catch {
            throw Fail("gzip")
        }
        guard crc32(out) == crc, UInt32(truncatingIfNeeded: out.count) == size else { throw Fail("gzip") }
        return out
    }

    private static let crcTable: [UInt32] = (0..<256).map { n -> UInt32 in
        var c = UInt32(n)
        for _ in 0..<8 { c = c & 1 != 0 ? 0xEDB8_8320 ^ (c >> 1) : c >> 1 }
        return c
    }

    static func crc32(_ d: Data) -> UInt32 {
        var c: UInt32 = 0xFFFF_FFFF
        for x in d { c = crcTable[Int((c ^ UInt32(x)) & 0xFF)] ^ (c >> 8) }
        return c ^ 0xFFFF_FFFF
    }

    /// 실패 이유를 짧게: offline · timeout · connect · ssl · HTTP 404 · sha256 · minShell · gzip · size · bad json · disk · closed · io
    static func reason(_ e: Error) -> String {
        if let f = e as? Fail { return f.code }
        let ns = e as NSError
        guard ns.domain == NSURLErrorDomain else { return "io" }
        switch ns.code {
        case NSURLErrorNotConnectedToInternet, NSURLErrorCannotFindHost, NSURLErrorDNSLookupFailed,
             NSURLErrorInternationalRoamingOff, NSURLErrorDataNotAllowed, NSURLErrorCallIsActive:
            return "offline"
        case NSURLErrorTimedOut:
            return "timeout"
        case NSURLErrorCannotConnectToHost, NSURLErrorNetworkConnectionLost:
            return "connect"
        case NSURLErrorSecureConnectionFailed, NSURLErrorServerCertificateHasBadDate, NSURLErrorServerCertificateUntrusted,
             NSURLErrorServerCertificateHasUnknownRoot, NSURLErrorServerCertificateNotYetValid,
             NSURLErrorClientCertificateRejected, NSURLErrorClientCertificateRequired,
             NSURLErrorAppTransportSecurityRequiresSecureConnection:
            return "ssl"
        case NSURLErrorCancelled:
            return "closed"
        default:
            return "io"
        }
    }

    static func host(_ url: String) -> String {
        guard let u = URL(string: url), let h = u.host else { return url }
        return u.port.map { "\(h):\($0)" } ?? h
    }

    /* ───────────────────────── 상태 → 게임 ───────────────────────── */

    func statusJson() -> String {
        lock.lock(); defer { lock.unlock() }
        let g = currentGame
        let s: [String: Any] = [
            "state": state,
            "current": ["version": g?.version ?? bundledVersion, "label": g?.label ?? bundledLabel],
            "latest": latestVersion.map { ["version": $0, "label": latestLabel ?? ""] as Any } ?? NSNull(),
            "error": error.map { $0 as Any } ?? NSNull(),
            "at": NSNumber(value: at),
            "applied": applied,
            "seq": seq,
            "shell": shell,
        ]
        guard let d = try? JSONSerialization.data(withJSONObject: s, options: [.sortedKeys]) else { return "null" }
        return String(decoding: d, as: UTF8.self)
    }

    /// 상태를 바꾼 그 잠금 안에서 부른다 → 바뀐 순서대로 전해진다 (listener 는 DispatchQueue.main.async 처럼 금방 끝나야 함)
    private func notifyStatus(_ done: Bool) {
        lock.lock(); defer { lock.unlock() }
        guard !closed, let listener else { return }
        listener(statusJson(), done)
    }

    /// 화면이 사라질 때 · 시험이 끝날 때: 확인을 멈춘다 (저장은 임시 파일 → rename 이라 중간에 멈춰도 안전)
    func close() {
        lock.lock()
        closed = true
        session.invalidateAndCancel()
        lock.unlock()
        sleeper.lock()
        sleeper.broadcast()
        sleeper.unlock()
    }

    /* ───────────────────────── 파일 · 기록 ───────────────────────── */

    static func readFile(_ f: URL, max: Int) throws -> Data {
        var u = f
        u.removeAllCachedResourceValues()
        let size = (try? u.resourceValues(forKeys: [.fileSizeKey]))?.fileSize ?? 0 // 크기만 (파일 시각은 읽지 않음 — PrivacyInfo.xcprivacy)
        if size > max { throw Fail("size") }
        do { return try Data(contentsOf: f) } catch { throw Fail("io") }
    }

    private static func jsonObject(_ d: Data) throws -> [String: Any] {
        guard let o = try? JSONSerialization.jsonObject(with: d), let m = o as? [String: Any] else { throw Fail("bad json") }
        return m
    }

    /// 같은 폴더의 임시 파일에 다 쓰고(fsync) rename — 중간에 꺼져도 예전 파일이 그대로 남는다
    static func writeAtomic(_ f: URL, _ data: Data) throws {
        let tmp = f.deletingLastPathComponent()
            .appendingPathComponent(f.lastPathComponent + "." + UUID().uuidString.prefix(8).lowercased() + ".tmp")
        do {
            guard FileManager.default.createFile(atPath: tmp.path, contents: nil) else { throw Fail("disk") }
            let h = try FileHandle(forWritingTo: tmp)
            defer { try? h.close() }
            try h.write(contentsOf: data)
            try h.synchronize()
        } catch {
            try? FileManager.default.removeItem(at: tmp)
            throw Fail("disk")
        }
        if Darwin.rename(tmp.path, f.path) != 0 {
            try? FileManager.default.removeItem(at: tmp)
            throw Fail("disk")
        }
    }

    static func sha256(_ d: Data) -> Data { Data(SHA256.hash(data: d)) }

    static func hex(_ d: Data) -> String { d.map { String(format: "%02x", $0) }.joined() }

    static func nowMs() -> Int64 { Int64((Date().timeIntervalSince1970 * 1000).rounded()) }

    private static let stampFormat: DateFormatter = {
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.dateFormat = "yyyy-MM-dd HH:mm:ss Z"
        return f
    }()

    static func stamp() -> String { stampFormat.string(from: Date()) }

    /// Application Support/update.log 에 한 줄 (마지막 200줄만 남긴다). 콘솔에도 찍는다
    func log(_ msg: String) {
        let line = Self.stamp() + " " + msg.replacingOccurrences(of: "\n", with: " ")
        print("[update] " + msg)
        logLock.lock(); defer { logLock.unlock() }
        var buf = logBuf ?? (try? String(contentsOf: logFile, encoding: .utf8))?
            .split(separator: "\n").map(String.init) ?? []
        buf.append(line)
        if buf.count > Self.logLines {
            buf.removeFirst(buf.count - Self.logLines)
            try? Self.writeAtomic(logFile, Data((buf.joined(separator: "\n") + "\n").utf8))
        } else if let h = try? FileHandle(forWritingTo: logFile) {
            defer { try? h.close() }
            _ = try? h.seekToEnd()
            try? h.write(contentsOf: Data((line + "\n").utf8))
        } else {
            try? Data((line + "\n").utf8).write(to: logFile)
        }
        logBuf = buf
    }

    /// 기록 전체 (게임이 skwDesktop.update.log() 로 보여 줄 수 있게)
    func logText() -> String {
        logLock.lock(); defer { logLock.unlock() }
        return (try? String(contentsOf: logFile, encoding: .utf8)) ?? ""
    }
}

/// 요청 하나의 결과 (URLSession 델리게이트 큐가 채우고, 기다리던 쪽은 done 신호 뒤에 읽는다)
private final class Fetch {
    let max: Int
    var data = Data()
    var fail: Updater.Fail?
    var error: Error?
    let done = DispatchSemaphore(value: 0)
    init(max: Int) { self.max = max }
}

/// URLSession 델리게이트: 200 이 아니면 바로 끊고, 크기 제한을 넘으면 받는 중에 끊는다
private final class Fetcher: NSObject, URLSessionDataDelegate {
    private let lock = NSLock()
    private var fetches = [Int: Fetch]()

    func add(_ t: URLSessionTask, _ f: Fetch) {
        lock.lock(); fetches[t.taskIdentifier] = f; lock.unlock()
    }

    private func fetch(_ t: URLSessionTask, remove: Bool = false) -> Fetch? {
        lock.lock(); defer { lock.unlock() }
        return remove ? fetches.removeValue(forKey: t.taskIdentifier) : fetches[t.taskIdentifier]
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive response: URLResponse,
                    completionHandler: @escaping (URLSession.ResponseDisposition) -> Void) {
        guard let f = fetch(dataTask) else { return completionHandler(.cancel) }
        let code = (response as? HTTPURLResponse)?.statusCode ?? 0
        if code != 200 {
            f.fail = Updater.Fail("HTTP \(code)")
            return completionHandler(.cancel)
        }
        if response.expectedContentLength > Int64(f.max) {
            f.fail = Updater.Fail("size")
            return completionHandler(.cancel)
        }
        completionHandler(.allow)
    }

    func urlSession(_ session: URLSession, dataTask: URLSessionDataTask, didReceive data: Data) {
        guard let f = fetch(dataTask), f.fail == nil else { return }
        f.data.append(data)
        if f.data.count > f.max {
            f.fail = Updater.Fail("size")
            dataTask.cancel()
        }
    }

    func urlSession(_ session: URLSession, task: URLSessionTask, didCompleteWithError error: Error?) {
        guard let f = fetch(task, remove: true) else { return }
        f.error = error
        f.done.signal()
    }
}

/// 여러 스레드가 넣고 한 스레드가 꺼내는 상자 (ExecutorCompletionService.poll 대신)
private final class Inbox<T> {
    private let c = NSCondition()
    private var items = [T]()

    func put(_ x: T) {
        c.lock(); items.append(x); c.signal(); c.unlock()
    }

    /// end 까지 기다려 하나 꺼낸다 (없으면 nil). stop() 이 참이 되면 바로 nil
    func poll(until end: Date, stop: () -> Bool) -> T? {
        c.lock(); defer { c.unlock() }
        while items.isEmpty {
            let now = Date()
            if now >= end || stop() { return nil }
            _ = c.wait(until: min(end, now.addingTimeInterval(0.25)))
        }
        return items.removeFirst()
    }
}
