import XCTest

/// Updater.swift 시험 — 가짜 서버(StubProtocol: URLProtocol)로 Android Updater.java 와 같은 규칙인지 본다.
/// 앱 없이(호스트 없음) Updater.swift 만 이 시험 묶음에 함께 컴파일된다 (project.yml).
final class UpdaterTests: XCTestCase {
    private var dir: URL!
    private var ups: [Updater] = []
    private let A = "https://a.test/u/", B = "https://b.test/u/"

    override func setUp() {
        super.setUp()
        dir = FileManager.default.temporaryDirectory.appendingPathComponent("skw-test-" + UUID().uuidString, isDirectory: true)
        try? FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true)
        StubProtocol.reset()
    }

    override func tearDown() {
        ups.forEach { $0.close() }
        ups = []
        StubProtocol.reset()
        try? FileManager.default.removeItem(at: dir)
        super.tearDown()
    }

    // ── 도우미 ──

    private final class Events {
        private let lock = NSLock()
        private var list = [(String, Bool)]()
        func add(_ j: String, _ d: Bool) { lock.lock(); list.append((j, d)); lock.unlock() }
        var all: [(String, Bool)] { lock.lock(); defer { lock.unlock() }; return list }
    }

    private func make(bases: [String]? = nil, shell: String = "1.6.0", bundled: String = "1.6.0", events: Events? = nil) -> Updater {
        let c = URLSessionConfiguration.ephemeral
        c.protocolClasses = [StubProtocol.self]
        let up = Updater(dataDir: dir, bases: bases ?? [A, B], shell: shell, bundledVersion: bundled, bundledLabel: "0.16",
                         configuration: c) { j, d in events?.add(j, d) }
        up.latestTimeout = 1.0
        up.gameTimeout = 2.0
        up.backoff = 0.1
        up.grace = 0.3
        ups.append(up)
        return up
    }

    private func status(_ up: Updater) -> [String: Any] {
        (try? JSONSerialization.jsonObject(with: Data(up.statusJson().utf8))) as? [String: Any] ?? [:]
    }

    private func latestVersion(_ s: [String: Any]) -> String? { (s["latest"] as? [String: Any])?["version"] as? String }

    @discardableResult
    private func runCheck(_ up: Updater, timeout: TimeInterval = 15) -> [String: Any] {
        XCTAssertGreaterThan(up.check("test"), 0)
        let end = Date().addingTimeInterval(timeout)
        while up.busy() && Date() < end { Thread.sleep(forTimeInterval: 0.02) }
        XCTAssertFalse(up.busy(), "check did not finish in \(timeout)s")
        return status(up)
    }

    private func html(_ v: String) -> Data { Data("<!doctype html><html><head><meta charset=\"utf-8\"></head><body>game \(v)</body></html>".utf8) }

    private func sha(_ d: Data) -> String { Updater.hex(Updater.sha256(d)) }

    private func manifest(_ v: String, body: Data, label: String? = nil, minShell: String = "1.2.0", file: String = "game.gz", sha256: String? = nil) -> Data {
        var j: [String: Any] = ["version": v, "file": file, "sha256": sha256 ?? sha(body), "size": body.count, "minShell": minShell]
        j["label"] = label ?? "0." + v.split(separator: ".")[1]
        return try! JSONSerialization.data(withJSONObject: j)
    }

    /// base 에 버전 v 게임을 올린다 (game.gz 본문 = body, 기본은 gzip 하지 않은 HTML — Updater 는 둘 다 받는다)
    private func publish(_ base: String, _ v: String, body: Data? = nil, gz: Data? = nil, minShell: String = "1.2.0", sha256: String? = nil) {
        let b = body ?? html(v)
        StubProtocol.set(base + "latest.json", .init(body: manifest(v, body: b, minShell: minShell, sha256: sha256)))
        StubProtocol.set(base + "game.gz", .init(body: gz ?? b))
    }

    private func gameFiles() -> [String] {
        ((try? FileManager.default.contentsOfDirectory(atPath: dir.appendingPathComponent("game").path)) ?? []).sorted()
    }

    // Node 의 zlib.gzipSync 로 만든 game.gz (PC판 publish-update.js 와 같은 방법) — 다른 구현과 맞는지
    private let nodeHTML = Data(("<!doctype html><html><head><meta charset=\"utf-8\"><title>SKW test 1.7.0</title></head><body>제 2차 한국전쟁 1.7.0 "
        + String(repeating: "x", count: 300) + "</body></html>").utf8)
    private let nodeGz = Data(base64Encoded: "H4sIAAAAAAAAA7NRTMlPLqksSFXIKMnNsbOBkqmJKXY2uakliQrJGYlFxakltkqlJWm6Fkp2NiWZJTmpdsHe4QolqcUlCoZ65noGNvoQURt9iM6k/JRKuzcL5igYvdmwQuHt1Dmvtq59s6DlzfxGiHqFilFANLDRBwenjT44bgBuJ5FAsQEAAA==")!
    private let nodeSha = "fb37f9a49db9a6a330ecc902397d3f97595574d87bf15ddf76a2ba84a6ada02a"

    // ── 시험 ──

    func testVersionCompare() {
        XCTAssertTrue(Updater.newer("1.10.0", "1.9.0"))
        XCTAssertFalse(Updater.newer("1.9.0", "1.10.0"))
        XCTAssertEqual(Updater.compare("1.6", "1.6.0"), 0)
        XCTAssertTrue(Updater.newer("1.6.1", "1.6"))
        XCTAssertTrue(Updater.newer("2.0.0", "1.99.99"))
        XCTAssertFalse(Updater.newer("1.6.0", "1.6.0"))
        XCTAssertEqual(Updater.cleanVersion("1.6.0"), "1.6.0")
        XCTAssertNil(Updater.cleanVersion("1.6.0-beta"))
        XCTAssertNil(Updater.cleanVersion(160))
        XCTAssertEqual(Updater.cleanLabel("0.16"), "0.16")
        XCTAssertEqual(Updater.cleanLabel("<b>"), "")
        XCTAssertNil(Updater.cleanSha("abc"))
        // 글자 전체가 맞아야 함 (Java Matcher.matches() 와 같게): ICU 의 $ 는 끝 줄바꿈 앞에서도 맞으므로 \A…\z
        XCTAssertNil(Updater.cleanVersion("1.7.0\n"))
        XCTAssertNil(Updater.cleanVersion("\n1.7.0"))
        XCTAssertEqual(Updater.cleanLabel("0.17\n"), "")
        XCTAssertEqual(Updater.cleanLabel("0.17\r\n"), "")
        XCTAssertNil(Updater.cleanSha(String(repeating: "a", count: 64) + "\n"))
        XCTAssertFalse(Updater.isFileName("game.gz\n"))
        XCTAssertTrue(Updater.isFileName("game.gz"))
        XCTAssertEqual(Updater.cleanVersion("1"), "1")
    }

    /// latest.json 의 label · version 끝에 줄바꿈이 붙어 와도 그 값은 쓰지 않는다 (다리 스크립트에 그대로 들어가지 않게)
    func testTrailingNewlineInManifestIsRejected() {
        let up = make()
        publish(A, "1.7.0")
        let body = html("1.7.0")
        // JSON 의 "\n" = 줄바꿈 한 글자
        StubProtocol.set(A + "latest.json", .init(body: Data(#"{"version":"1.7.0\n","label":"0.17","file":"game.gz","sha256":"\#(sha(body))"}"#.utf8)))
        StubProtocol.set(B + "latest.json", .init(status: 404))
        let s = runCheck(up)
        XCTAssertEqual(s["state"] as? String, "error")
        XCTAssertEqual(s["error"] as? String, "bad json, HTTP 404")
        XCTAssertEqual(gameFiles(), [])
        // label 만 줄바꿈이면 버전은 쓰되 label 은 비운다 (Java 와 같게)
        StubProtocol.set(A + "latest.json", .init(body: Data(#"{"version":"1.7.0","label":"0.17\n","file":"game.gz","sha256":"\#(sha(body))"}"#.utf8)))
        let s2 = runCheck(up)
        XCTAssertEqual(s2["state"] as? String, "ready")
        XCTAssertEqual((s2["latest"] as? [String: Any])?["label"] as? String, "")
    }

    func testGunzipMatchesNode() throws {
        XCTAssertEqual(try Updater.gunzip(nodeGz, max: 1 << 20), nodeHTML)
        XCTAssertEqual(sha(nodeHTML), nodeSha)
        XCTAssertEqual(try Updater.gunzip(nodeHTML, max: 1 << 20), nodeHTML) // 이미 풀린 것은 그대로
        var bad = nodeGz
        bad[bad.count - 9] ^= 0xff // 본문 끝을 망가뜨림 → CRC 가 안 맞음
        XCTAssertThrowsError(try Updater.gunzip(bad, max: 1 << 20)) { XCTAssertEqual(($0 as? Updater.Fail)?.code, "gzip") }
        XCTAssertThrowsError(try Updater.gunzip(nodeGz, max: 100)) { XCTAssertEqual(($0 as? Updater.Fail)?.code, "size") }
    }

    /// 저장소의 진짜 desktop/update/game.gz (CI 가 SKW_REPO 를 넘겨 줄 때만)
    func testRealFeedFile() throws {
        guard let repo = ProcessInfo.processInfo.environment["SKW_REPO"] else { throw XCTSkip("SKW_REPO 없음") }
        let u = URL(fileURLWithPath: repo).appendingPathComponent("desktop/update")
        let m = try JSONSerialization.jsonObject(with: Data(contentsOf: u.appendingPathComponent("latest.json"))) as! [String: Any]
        let html = try Updater.gunzip(Data(contentsOf: u.appendingPathComponent("game.gz")), max: Updater.maxHTML)
        XCTAssertEqual(sha(html), m["sha256"] as? String)
        XCTAssertEqual(html.count, m["size"] as? Int)
    }

    func testNewerBecomesReadyAndApplies() {
        let ev = Events()
        let up = make(events: ev)
        up.useCached()
        publish(A, "1.7.0", body: nodeHTML, gz: nodeGz)
        publish(B, "1.6.0")
        let s = runCheck(up)
        XCTAssertEqual(s["state"] as? String, "ready")
        XCTAssertEqual(latestVersion(s), "1.7.0")
        XCTAssertEqual(gameFiles(), ["game-1.7.0.html", "version.json"])
        XCTAssertEqual(up.stored()?.version, "1.7.0")
        // 상태 순서: checking → downloading → ready (마지막만 done)
        let states = ev.all.map { ((try? JSONSerialization.jsonObject(with: Data($0.0.utf8))) as? [String: Any])?["state"] as? String ?? "?" }
        XCTAssertEqual(states.first, "checking")
        XCTAssertTrue(states.contains("downloading"))
        XCTAssertEqual(states.last, "ready")
        XCTAssertEqual(ev.all.last?.1, true)
        XCTAssertEqual(ev.all.filter { $0.1 }.count, 1)
        // 적용
        XCTAssertTrue(up.apply())
        XCTAssertEqual(up.current()?.version, "1.7.0")
        XCTAssertEqual(up.gameData(up.current()!), nodeHTML)
        let t = status(up)
        XCTAssertEqual(t["state"] as? String, "latest")
        XCTAssertEqual(t["applied"] as? Bool, true)
        XCTAssertEqual((t["current"] as? [String: Any])?["version"] as? String, "1.7.0")
        XCTAssertFalse(up.apply()) // 두 번째는 준비된 것이 없음
        // 다음 실행: 받아 둔 게임을 다시 확인하고 그걸로 시작 (이미 알린 버전이라 applied = false)
        let next = make()
        next.useCached()
        XCTAssertEqual(next.current()?.version, "1.7.0")
        XCTAssertEqual(status(next)["applied"] as? Bool, false)
    }

    func testStatusShape() {
        let up = make()
        let s = status(up)
        XCTAssertEqual(Set(s.keys), ["state", "current", "latest", "error", "at", "applied", "seq", "shell"])
        XCTAssertEqual(s["state"] as? String, "idle")
        XCTAssertTrue(s["latest"] is NSNull)
        XCTAssertEqual((s["current"] as? [String: Any])?["label"] as? String, "0.16")
        XCTAssertEqual(s["shell"] as? String, "1.6.0")
        XCTAssertFalse(up.apply())
    }

    func testLatestWhenSame() {
        let up = make()
        publish(A, "1.6.0")
        publish(B, "1.6.0")
        let s = runCheck(up)
        XCTAssertEqual(s["state"] as? String, "latest")
        XCTAssertEqual(latestVersion(s), "1.6.0")
        XCTAssertGreaterThan((s["at"] as? NSNumber)?.int64Value ?? 0, 0)
        XCTAssertEqual(StubProtocol.hits(A + "game.gz") + StubProtocol.hits(B + "game.gz"), 0)
    }

    func testHighestWins() {
        let up = make()
        publish(A, "1.7.0")
        publish(B, "1.8.0")
        let s = runCheck(up)
        XCTAssertEqual(s["state"] as? String, "ready")
        XCTAssertEqual(latestVersion(s), "1.8.0")
        XCTAssertEqual(StubProtocol.hits(B + "game.gz"), 1)
        XCTAssertEqual(StubProtocol.hits(A + "game.gz"), 0)
        XCTAssertEqual(up.stored()?.version, "1.8.0")
    }

    func testHangingBaseDoesNotBlock() {
        let up = make()
        StubProtocol.set(A + "latest.json", .init(hang: true)) // 말없이 막힌 주소 (학교 와이파이 등)
        publish(B, "1.7.0")
        let t0 = Date()
        let s = runCheck(up)
        XCTAssertEqual(s["state"] as? String, "ready")
        XCTAssertEqual(latestVersion(s), "1.7.0")
        // 막힌 주소의 시간 제한(1초) · 다시 시도를 기다리지 않음: grace 0.3초 + 받기
        XCTAssertLessThan(Date().timeIntervalSince(t0), 1.2)
    }

    func testFailingAndOlderBasesDoNotBlock() {
        let up = make()
        StubProtocol.set(A + "latest.json", .init(status: 500))
        publish(B, "1.7.0")
        var s = runCheck(up)
        XCTAssertEqual(s["state"] as? String, "ready")
        XCTAssertEqual(StubProtocol.hits(A + "latest.json"), 2) // 5xx 는 한 번 더
        // 옛 버전을 알려 주는 주소가 있어도 새것을 받는다
        StubProtocol.reset()
        let up2 = make(bases: [A, B])
        try? FileManager.default.removeItem(at: dir.appendingPathComponent("game"))
        publish(A, "1.5.0")
        publish(B, "1.7.0")
        s = runCheck(up2)
        XCTAssertEqual(s["state"] as? String, "ready")
        XCTAssertEqual(latestVersion(s), "1.7.0")
    }

    func testNotFoundIsNotRetriedAndOfflineIsError() {
        let up = make()
        StubProtocol.set(A + "latest.json", .init(status: 404))
        StubProtocol.set(B + "latest.json", .init(error: .notConnectedToInternet))
        let s = runCheck(up)
        XCTAssertEqual(s["state"] as? String, "error")
        XCTAssertEqual(s["error"] as? String, "HTTP 404, offline")
        XCTAssertEqual(StubProtocol.hits(A + "latest.json"), 1) // 4xx 는 다시 해도 같으므로 한 번만
        XCTAssertEqual(StubProtocol.hits(B + "latest.json"), 2)
    }

    func testShaMismatchSavesNothing() {
        let up = make()
        publish(A, "1.7.0", sha256: String(repeating: "0", count: 64))
        publish(B, "1.6.0")
        let s = runCheck(up)
        XCTAssertEqual(s["state"] as? String, "error")
        XCTAssertEqual(s["error"] as? String, "sha256")
        XCTAssertEqual(gameFiles().filter { !$0.hasSuffix(".tmp") }, [])
        XCTAssertNil(up.stored())
        XCTAssertFalse(up.apply())
    }

    func testMinShellTooHighDoesNotDownload() {
        let up = make()
        publish(A, "1.7.0", minShell: "9.0.0")
        publish(B, "1.7.0", minShell: "9.0.0")
        let s = runCheck(up)
        XCTAssertEqual(s["state"] as? String, "error")
        XCTAssertTrue((s["error"] as? String ?? "").hasPrefix("minShell"))
        XCTAssertEqual(latestVersion(s), "1.7.0")
        XCTAssertEqual(StubProtocol.hits(A + "game.gz") + StubProtocol.hits(B + "game.gz"), 0)
        XCTAssertEqual(gameFiles(), [])
    }

    func testNeverDowngrade() {
        // 1) 앱에 든 게임보다 옛것은 받지 않음
        let up = make()
        publish(A, "1.5.0")
        publish(B, "1.5.9")
        var s = runCheck(up)
        XCTAssertEqual(s["state"] as? String, "latest")
        XCTAssertEqual(StubProtocol.hits(A + "game.gz") + StubProtocol.hits(B + "game.gz"), 0)
        // 2) 1.8.0 을 받아 둔 뒤 주소들이 1.7.0 을 알려 줘도 1.8.0 그대로 (ready)
        publish(A, "1.8.0")
        s = runCheck(up)
        XCTAssertEqual(latestVersion(s), "1.8.0")
        publish(A, "1.7.0")
        publish(B, "1.7.0")
        s = runCheck(up)
        XCTAssertEqual(s["state"] as? String, "ready")
        XCTAssertEqual(latestVersion(s), "1.8.0")
        XCTAssertEqual(up.stored()?.version, "1.8.0")
        // 3) 앱을 새로 설치해 앱에 든 게임이 같거나 새것이면 받아 둔 것을 쓰지 않고 지운다
        let fresh = make(shell: "1.8.0", bundled: "1.8.0")
        fresh.useCached()
        XCTAssertNil(fresh.current())
        XCTAssertEqual(gameFiles(), [])
    }

    func testStoredGameIsReverified() throws {
        let up = make()
        publish(A, "1.7.0")
        runCheck(up)
        XCTAssertEqual(up.stored()?.version, "1.7.0")
        try Data("tampered".utf8).write(to: dir.appendingPathComponent("game/game-1.7.0.html"))
        let next = make()
        next.useCached()
        XCTAssertNil(next.current()) // sha256 이 맞지 않으면 앱에 든 게임으로
        XCTAssertFalse(up.apply())   // 바뀐 파일로는 적용하지 않음
        XCTAssertEqual(status(up)["error"] as? String, "sha256")
    }

    func testSingleFlight() {
        let up = make()
        StubProtocol.set(A + "latest.json", .init(body: manifest("1.6.0", body: html("1.6.0")), delay: 0.4))
        StubProtocol.set(B + "latest.json", .init(body: manifest("1.6.0", body: html("1.6.0")), delay: 0.4))
        let a = up.check("one")
        let b = up.check("two")
        XCTAssertEqual(a, b) // 확인 중에 또 부르면 같은 확인
        XCTAssertTrue(up.busy())
        let end = Date().addingTimeInterval(10)
        while up.busy() && Date() < end { Thread.sleep(forTimeInterval: 0.02) }
        XCTAssertEqual(StubProtocol.hits(A + "latest.json"), 1)
        XCTAssertEqual(StubProtocol.hits(B + "latest.json"), 1)
        XCTAssertEqual(status(up)["seq"] as? Int, a)
        XCTAssertEqual(up.check("three"), a + 1) // 끝난 뒤에는 새 확인
    }

    func testCloseStopsChecks() {
        let up = make()
        StubProtocol.set(A + "latest.json", .init(hang: true))
        StubProtocol.set(B + "latest.json", .init(hang: true))
        XCTAssertGreaterThan(up.check("x"), 0)
        up.close()
        XCTAssertEqual(up.check("y"), 0)
    }

    func testLogKeepsLast200Lines() {
        let up = make()
        for i in 1...250 { up.log("line \(i)") }
        let lines = up.logText().split(separator: "\n")
        XCTAssertEqual(lines.count, 200)
        XCTAssertTrue(lines.first?.hasSuffix(" line 51") ?? false)
        XCTAssertTrue(lines.last?.hasSuffix(" line 250") ?? false)
        // 다시 연 Updater(다음 실행)도 이어서 200줄
        let again = make()
        for i in 251...260 { again.log("line \(i)") }
        let l2 = again.logText().split(separator: "\n")
        XCTAssertEqual(l2.count, 200)
        XCTAssertTrue(l2.last?.hasSuffix(" line 260") ?? false)
    }

    func testCacheBusting() {
        let u = Updater.bust("https://a.test/u/latest.json")!.absoluteString
        XCTAssertTrue(u.hasPrefix("https://a.test/u/latest.json?t="))
        XCTAssertTrue(Updater.bust("https://a.test/x?y=1")!.absoluteString.contains("?y=1&t="))
    }
}

/// 가짜 서버: 주소(쿼리 ?t= 는 뺌)마다 답을 정해 둔다
final class StubProtocol: URLProtocol {
    struct Route {
        var status = 200
        var body = Data()
        var delay: TimeInterval = 0
        var hang = false
        var error: URLError.Code?
        init(status: Int = 200, body: Data = Data(), delay: TimeInterval = 0, hang: Bool = false, error: URLError.Code? = nil) {
            self.status = status; self.body = body; self.delay = delay; self.hang = hang; self.error = error
        }
    }

    private static let lock = NSLock()
    private static var routes = [String: Route]()
    private static var counts = [String: Int]()

    static func reset() { lock.lock(); routes = [:]; counts = [:]; lock.unlock() }
    static func set(_ url: String, _ r: Route) { lock.lock(); routes[url] = r; lock.unlock() }
    static func hits(_ url: String) -> Int { lock.lock(); defer { lock.unlock() }; return counts[url] ?? 0 }

    private static func key(_ u: URL?) -> String {
        guard let u, var c = URLComponents(url: u, resolvingAgainstBaseURL: false) else { return "" }
        c.query = nil
        return c.string ?? ""
    }

    private var stopped = false
    private let stopLock = NSLock()

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        let k = Self.key(request.url)
        Self.lock.lock()
        Self.counts[k, default: 0] += 1
        let r = Self.routes[k] ?? Route(status: 404)
        Self.lock.unlock()
        if r.hang { return } // 답하지 않음 (취소될 때까지)
        let rl = CFRunLoopGetCurrent()
        let url = request.url!
        let deliver = { [weak self] in
            guard let self, let client = self.client else { return }
            self.stopLock.lock(); let s = self.stopped; self.stopLock.unlock()
            if s { return }
            if let e = r.error {
                client.urlProtocol(self, didFailWithError: URLError(e))
                return
            }
            let resp = HTTPURLResponse(url: url, statusCode: r.status, httpVersion: "HTTP/1.1",
                                       headerFields: ["Content-Length": String(r.body.count)])!
            client.urlProtocol(self, didReceive: resp, cacheStoragePolicy: .notAllowed)
            client.urlProtocol(self, didLoad: r.body)
            client.urlProtocolDidFinishLoading(self)
        }
        if r.delay <= 0 {
            deliver()
        } else {
            DispatchQueue.global().asyncAfter(deadline: .now() + r.delay) {
                CFRunLoopPerformBlock(rl, CFRunLoopMode.defaultMode.rawValue, deliver)
                CFRunLoopWakeUp(rl)
            }
        }
    }

    override func stopLoading() {
        stopLock.lock(); stopped = true; stopLock.unlock()
    }
}
