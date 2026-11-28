import UIKit
import WebKit

/// Second Korean Wars — iPhone · iPad 앱 본체.
///
/// 스토리 게임(HTML 한 파일, WebGPU)을 WKWebView 하나에 띄운다 (Android 의 MainActivity 와 같은 일).
///  - 게임은 앱 안(Game/index.html)에 있고 skw://game/index.html 로 서빙한다 (WKURLSchemeHandler).
///    file:// 대신 전용 주소를 쓰는 까닭: 보안 출처(isSecureContext)여야 WebGPU 가 켜지고, 앱에 든 게임이든 자동 업데이트로 받은
///    게임이든 같은 출처(skw://game)라 localStorage(설정 · 진행)가 업데이트 뒤에도 그대로 남는다. 게임 페이지는 앱 밖 주소를 불러오지 않는다.
///  - 게임 자동 업데이트 (Updater, PC판 · Android 와 같은 desktop/update/latest.json + game.gz): 켤 때 최대 4초 기다려 새 게임을 받으면
///    바로 그걸로 시작하고, 아니면 지금 게임으로 시작해 뒤에서 받는다 (다음 시작 · '지금 적용' 때 사용). 앞에 있는 동안 30분마다 다시 확인.
///    Info.plist 의 SKWAutoUpdate 를 NO 로 하면 코드 수정 없이 끈다 (그때는 앱에 든 게임만, 업데이트 표시도 없음).
///  - 게임과의 약속: window.skwDesktop (platform 'ios', skwDesktop.update 포함) 은 Web/ios-shim.js 를 문서 시작 때 끼워 넣어 만든다.
///    다리는 WKScriptMessageHandlerWithReply 'skw' 하나: {op, arg} → 답.
///  - 앱이 뒤로 가면(sceneWillResignActive) window.__skwIOS.pause() — 일시정지 메뉴 · 소리 멈춤, 돌아오면 resume().
final class GameViewController: UIViewController {
    static let scheme = "skw"
    static let host = "game"
    static let startURL = URL(string: "skw://game/index.html")!
    static let background = UIColor(red: 5 / 255, green: 8 / 255, blue: 12 / 255, alpha: 1) // 게임 배경 #05080c
    private static let startupWait: TimeInterval = 4      // 켤 때 업데이트 확인 · 받기를 기다리는 최대 시간 (자동 시험은 바꿀 수 있음)
    private static let recheckEvery: TimeInterval = 30 * 60 // 앞에 있는 동안 다시 확인하는 간격
    private static let crashWindow: TimeInterval = 30      // 이 시간 안에 웹 프로세스가 3번 죽으면 자동 다시 불러오기를 멈춤

    /// 지금 시각(초) — 기기가 잠든 동안에도 흐르는 단조 시계 (Android SystemClock.elapsedRealtime 과 같게).
    /// ProcessInfo.systemUptime 은 잠든 동안 멈춰서, 몇 시간 잠갔다 돌아와도 30분 재확인이 바로 되지 않는다
    static func clock() -> TimeInterval { TimeInterval(clock_gettime_nsec_np(CLOCK_MONOTONIC)) / 1e9 }

    /// 다리 스크립트에 넣는 값: 앱이 이미 검사한 번호지만, 한 번 더 따옴표 · 줄바꿈 · 역슬래시가 절대 들어가지 않게 거른다
    static func jsSafe(_ s: String) -> String {
        String(s.unicodeScalars.filter { $0.isASCII && (CharacterSet.alphanumerics.contains($0) || "._+-".unicodeScalars.contains($0)) }.map(Character.init))
    }

    private var web: WKWebView?
    private let schemeHandler = GameSchemeHandler()
    private var notice: UIView?
    private var updater: Updater?
    private let shell: String          // 앱(껍데기)의 내부 번호 = 앱에 든 게임의 번호 (desktop/package.json 의 version)
    private let bundledLabel: String   // 앱에 든 게임의 보이는 번호 (skwLabel)
    private let bundledURL: URL?
    private let shimTemplate: String?
    let selfTest: SelfTest?
    private var started = false        // 게임 페이지를 처음 불러왔는가 (켤 때 업데이트 확인을 기다리는 동안 false)
    private var active = false
    private var lastCheck: TimeInterval = -.greatestFiniteMagnitude
    private var startWork: DispatchWorkItem?
    private var recheckWork: DispatchWorkItem?
    private var crashCount = 0
    private var lastCrash: TimeInterval = -.greatestFiniteMagnitude
    private(set) var served = (version: "", label: "", downloaded: false)

    init() {
        let b = Bundle.main
        let st = SelfTest.fromArguments()
        selfTest = st
        bundledURL = b.url(forResource: "index", withExtension: "html", subdirectory: "Game")
        // Game/version.json (prepare-resources.js 가 씀): {내부 번호, 보이는 번호}. 없으면 Info.plist 에서
        var v: String?, l = ""
        if let u = b.url(forResource: "version", withExtension: "json", subdirectory: "Game"),
           let d = try? Data(contentsOf: u), let j = try? JSONSerialization.jsonObject(with: d) as? [String: Any] {
            v = Updater.cleanVersion(j["version"])
            l = Updater.cleanLabel(j["label"])
        }
        shell = st?.shellOverride ?? v ?? Updater.cleanVersion(b.object(forInfoDictionaryKey: "SKWShellVersion")) ?? "0.0.0"
        bundledLabel = l.isEmpty ? Updater.cleanLabel(b.object(forInfoDictionaryKey: "CFBundleShortVersionString")) : l
        shimTemplate = b.url(forResource: "ios-shim", withExtension: "js").flatMap { try? String(contentsOf: $0, encoding: .utf8) }
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError("init(coder:) is not used") }

    /// Info.plist SKWAutoUpdate (기본 YES). 앱 심사에서 요구하면 NO 로 바꿔 내용 업데이트를 끈다
    static var autoUpdateEnabled: Bool {
        (Bundle.main.object(forInfoDictionaryKey: "SKWAutoUpdate") as? Bool) ?? true
    }

    /* ───────────────────────── 화면 ───────────────────────── */

    override var prefersStatusBarHidden: Bool { true }
    override var prefersHomeIndicatorAutoHidden: Bool { true }
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge { .all } // 가장자리 밀기가 게임 조작을 먼저 받게
    override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }

    override func loadView() {
        let v = UIView()
        v.backgroundColor = Self.background
        view = v
    }

    override func viewDidLoad() {
        super.viewDidLoad()
        // 자동 업데이트: 받아 둔 새 게임이 있으면 그걸 띄우고(디스크만), 네트워크 확인은 Updater 의 큐에서
        if Self.autoUpdateEnabled, let dir = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first {
            let up = Updater(dataDir: dir, shell: shell, bundledVersion: shell, bundledLabel: bundledLabel) { [weak self] json, done in
                DispatchQueue.main.async { self?.onUpdateStatus(json, done) }
            }
            updater = up
            if selfTest?.bundledOnly != true { up.useCached() } // 자동 시험 --skw-selftest-bundled: 앱에 든 게임만 띄움 (확인 · 받기는 그대로)
        }
        createWebView() // 게임은 startGame() 에서 불러온다
        if startCheck("start") > 0 {
            let w = DispatchWorkItem { [weak self] in self?.startGame() } // 늦어도 4초 뒤에는 지금 게임으로 시작
            startWork = w
            DispatchQueue.main.asyncAfter(deadline: .now() + (selfTest?.startupWait ?? Self.startupWait), execute: w)
        } else {
            startGame()
        }
    }

    /// 앱이 앞으로 (SceneDelegate)
    func didBecomeActive() {
        active = true
        setNeedsUpdateOfHomeIndicatorAutoHidden()
        setNeedsUpdateOfScreenEdgesDeferringSystemGestures()
        js("window.__skwIOS?window.__skwIOS.resume():-1") { r in print("[SKW] lifecycle resume: \(r ?? "nil")") }
        scheduleRecheck()
    }

    /// 앱이 뒤로 · 제어 센터 · 전화 (SceneDelegate): 일시정지 메뉴를 띄우고 소리를 멈춘다 (WebKit 이 뒤에서 페이지를 멈추기 전에)
    func willResignActive() {
        active = false
        recheckWork?.cancel()
        js("window.__skwIOS?window.__skwIOS.pause():-1") { r in print("[SKW] lifecycle pause: \(r ?? "nil")") }
    }

    /* ───────────────────────── WKWebView ───────────────────────── */

    private func createWebView() {
        let cfg = WKWebViewConfiguration()
        cfg.websiteDataStore = .default()                        // localStorage: 설정 · 진행 저장 (앱을 껐다 켜도 남음)
        cfg.setURLSchemeHandler(schemeHandler, forURLScheme: Self.scheme)
        cfg.mediaTypesRequiringUserActionForPlayback = []         // 소리를 터치 없이도 낼 수 있게 (Web Audio)
        cfg.allowsInlineMediaPlayback = true
        cfg.allowsAirPlayForMediaPlayback = false
        cfg.allowsPictureInPictureMediaPlayback = false
        cfg.dataDetectorTypes = []
        cfg.preferences.javaScriptCanOpenWindowsAutomatically = false
        cfg.defaultWebpagePreferences.allowsContentJavaScript = true
        cfg.defaultWebpagePreferences.preferredContentMode = .mobile // iPad 도 휴대 기기 화면 규칙 (터치 조작 · 화소 예산)
        let ucc = WKUserContentController()
        ucc.addScriptMessageHandler(WeakBridge(self), contentWorld: .page, name: "skw")
        cfg.userContentController = ucc

        let v = WKWebView(frame: view.bounds, configuration: cfg)
        v.autoresizingMask = [.flexibleWidth, .flexibleHeight]
        v.isOpaque = false
        v.backgroundColor = Self.background
        v.underPageBackgroundColor = Self.background
        v.scrollView.backgroundColor = Self.background
        v.scrollView.isScrollEnabled = false
        v.scrollView.bounces = false
        v.scrollView.contentInsetAdjustmentBehavior = .never     // 노치 · 홈 표시줄 아래까지 그림 (게임이 env(safe-area-inset-*) 로 여백을 둔다)
        v.scrollView.delaysContentTouches = false
        v.allowsBackForwardNavigationGestures = false
        v.allowsLinkPreview = false
        v.navigationDelegate = self
        v.uiDelegate = self
        #if DEBUG
        v.isInspectable = true // 개발용 빌드만: Mac 의 Safari › 개발자 메뉴에서 게임 페이지를 볼 수 있음
        #endif
        if selfTest != nil { v.isInspectable = true }
        view.addSubview(v)
        web = v
        if started { loadGame() } // 켤 때는 업데이트 확인이 끝난 뒤(최대 4초) startGame() 이 불러온다
    }

    private func js(_ code: String, _ done: ((String?) -> Void)? = nil) {
        guard let web else { done?(nil); return }
        web.evaluateJavaScript(code) { r, e in done?(e != nil ? "error: \(e!.localizedDescription)" : r.map { "\($0)" }) }
    }

    /// 띄울 게임을 고르고(받아 둔 새 게임 또는 앱에 든 게임) 다리 스크립트를 그 번호로 채운 뒤 불러온다
    private func loadGame() {
        guard let web else { return }
        var html: Data? = bundledURL.flatMap { try? Data(contentsOf: $0) }
        var ver = shell, lab = bundledLabel, downloaded = false
        if selfTest?.bundledOnly != true, let up = updater, let g = up.current(), let d = up.gameData(g) {
            html = d
            ver = g.version
            lab = g.label
            downloaded = true
        }
        guard let html else {
            showNotice(title: "load_title", body: NSLocalizedString("load_body", comment: ""))
            return
        }
        schemeHandler.html = html
        served = (ver, lab, downloaded)
        let ucc = web.configuration.userContentController
        ucc.removeAllUserScripts()
        selfTest?.userScripts().forEach { ucc.addUserScript($0) }
        if let t = shimTemplate {
            let src = t.replacingOccurrences(of: "__SKW_VERSION__", with: Self.jsSafe(ver))
                .replacingOccurrences(of: "__SKW_LABEL__", with: Self.jsSafe(lab))
                .replacingOccurrences(of: "__SKW_SHELL__", with: Self.jsSafe(shell))
                .replacingOccurrences(of: "__SKW_UPDATE__", with: updater != nil ? "1" : "0")
            ucc.addUserScript(WKUserScript(source: src, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        print("[SKW] load game \(ver) (\(lab.isEmpty ? "-" : lab)) " + (downloaded ? "downloaded" : "bundled") + " · shell \(shell)")
        if selfTest?.serveFile == true, let u = bundledURL {
            web.loadFileURL(u, allowingReadAccessTo: u.deletingLastPathComponent()) // 비교 시험용 (file://)
        } else {
            web.load(URLRequest(url: Self.startURL))
        }
        selfTest?.attach(to: self, web: web)
    }

    /* ───────────────────────── 게임 ↔ 앱 다리 (window.webkit.messageHandlers.skw) ───────────────────────── */

    fileprivate func onMessage(_ message: WKScriptMessage, reply: @escaping (Any?, String?) -> Void) {
        let origin = message.frameInfo.securityOrigin
        let ours = origin.protocol == Self.scheme || (selfTest?.serveFile == true && origin.protocol == "file")
        guard message.frameInfo.isMainFrame, ours, let body = message.body as? [String: Any], let op = body["op"] as? String else {
            return reply(nil, "bad message")
        }
        let arg = body["arg"]
        switch op {
        case "open":
            if let s = arg as? String { openExternal(s) }
            reply(true, nil)
        case "updStatus": // 자동 업데이트 상태 S (JSON 글자)
            reply(updater?.statusJson() ?? "null", nil)
        case "updCheck": // 지금 확인 (이미 확인 중이면 그 확인). 답 = 확인 번호 (0 = 못 함). 결과는 window.__skwUpd(S) 로 간다
            reply(updater?.check("manual") ?? 0, nil)
        case "updApply": // 받아 둔 새 게임으로 바꾸고 처음 화면부터 다시 불러온다. false = 준비된 게임 없음
            guard let up = updater, up.apply() else { return reply(false, nil) }
            reply(true, nil)
            DispatchQueue.main.async { [weak self] in self?.reloadGame() }
        case "updLog": // 업데이트 기록 (Application Support/update.log) — 안 될 때 원인을 보려고
            reply(updater?.logText() ?? "", nil)
        case "gpu": // ios-shim.js 의 WebGPU 확인 결과 (기록용 — 안내 화면은 게임이 직접 보여 준다)
            print("[SKW] WebGPU: \(arg ?? "?")")
            reply(true, nil)
        default:
            reply(nil, "unknown op")
        }
    }

    /* ───────────────────────── 게임 자동 업데이트 ───────────────────────── */

    /// 게임 페이지를 처음 불러온다 (켤 때 업데이트 확인이 끝났거나 startupWait 가 지났을 때, 한 번만)
    private func startGame() {
        startWork?.cancel()
        startWork = nil
        if started { return }
        started = true
        if let up = updater, up.busy() {
            up.log("켬: \(Int((selfTest?.startupWait ?? Self.startupWait) * 1000))ms 안에 확인이 끝나지 않아 지금 게임으로 시작 (확인은 계속)")
        }
        loadGame()
    }

    /// Updater 의 상태가 바뀜 (메인 스레드). 켜는 중이면 확인이 끝나는 대로 시작, 아니면 게임에 알린다
    private func onUpdateStatus(_ json: String, _ done: Bool) {
        guard let up = updater else { return }
        if !started {
            guard done else { return }
            if selfTest?.bundledOnly != true, up.apply() { up.log("켬: 새 게임을 받아서 바로 그걸로 시작") } // 'ready' 일 때만 바뀐다 (S.applied = true)
            startGame()
            return
        }
        js("window.__skwUpd&&window.__skwUpd(\(json))")
    }

    @discardableResult
    private func startCheck(_ why: String) -> Int {
        lastCheck = Self.clock()
        return updater?.check(why) ?? 0
    }

    /// 앞에 있는 동안 recheckEvery 마다 (뒤에 있다가 돌아왔을 때 그 시간이 지났으면 바로)
    private func scheduleRecheck() {
        recheckWork?.cancel()
        guard updater != nil, active else { return }
        let w = DispatchWorkItem { [weak self] in self?.onRecheck() }
        recheckWork = w
        let wait = max(0, lastCheck + Self.recheckEvery - Self.clock())
        DispatchQueue.main.asyncAfter(deadline: .now() + wait, execute: w)
    }

    private func onRecheck() {
        guard active else { return }
        startCheck("timer")
        scheduleRecheck()
    }

    /// '지금 적용' · 다시 시도: 게임을 처음 화면부터
    private func reloadGame() {
        hideNotice()
        if web == nil { createWebView() }
        loadGame()
    }

    /// http/https 주소만 Safari(기본 브라우저)로 연다
    private func openExternal(_ s: String) {
        guard let u = URL(string: s.trimmingCharacters(in: .whitespaces)), let sc = u.scheme?.lowercased(),
              sc == "http" || sc == "https", u.host?.isEmpty == false else { return }
        UIApplication.shared.open(u)
    }

    /* ───────────────────────── 안내 화면 (불러오기 실패 · 반복 충돌) ───────────────────────── */

    private func showNotice(title: String, body: String) {
        hideNotice()
        let box = UIView()
        box.backgroundColor = Self.background.withAlphaComponent(0.96)
        box.frame = view.bounds
        box.autoresizingMask = [.flexibleWidth, .flexibleHeight]

        let t = UILabel()
        t.text = NSLocalizedString(title, comment: "")
        t.textColor = UIColor(red: 1, green: 0.54, blue: 0.36, alpha: 1)
        t.font = .boldSystemFont(ofSize: 20)
        t.textAlignment = .center
        t.numberOfLines = 0
        let b = UILabel()
        b.text = body
        b.textColor = UIColor(red: 0.87, green: 0.91, blue: 0.95, alpha: 1)
        b.font = .systemFont(ofSize: 15)
        b.textAlignment = .center
        b.numberOfLines = 0
        var bc = UIButton.Configuration.filled()
        bc.title = NSLocalizedString("btn_retry", comment: "")
        let retry = UIButton(configuration: bc, primaryAction: UIAction { [weak self] _ in self?.reloadGame() })

        let stack = UIStackView(arrangedSubviews: [t, b, retry])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 16
        stack.translatesAutoresizingMaskIntoConstraints = false
        box.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.centerXAnchor.constraint(equalTo: box.safeAreaLayoutGuide.centerXAnchor),
            stack.centerYAnchor.constraint(equalTo: box.safeAreaLayoutGuide.centerYAnchor),
            stack.widthAnchor.constraint(lessThanOrEqualToConstant: 560),
            stack.widthAnchor.constraint(lessThanOrEqualTo: box.safeAreaLayoutGuide.widthAnchor, constant: -48),
        ])
        view.addSubview(box)
        notice = box
    }

    private func hideNotice() {
        notice?.removeFromSuperview()
        notice = nil
    }
}

/* ───────────────────────── 이동 · 창 · 웹 프로세스 ───────────────────────── */

extension GameViewController: WKNavigationDelegate, WKUIDelegate {
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let u = action.request.url else { return decisionHandler(.cancel) }
        let s = u.scheme?.lowercased() ?? ""
        if s == Self.scheme || s == "about" || s == "data" || s == "blob" || (s == "file" && selfTest?.serveFile == true) {
            return decisionHandler(.allow)
        }
        // 앱 밖으로 가는 이동은 막고, 사용자가 누른 http/https 링크만 Safari 로 넘긴다
        if (s == "http" || s == "https") && action.navigationType == .linkActivated { openExternal(u.absoluteString) }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let u = action.request.url { openExternal(u.absoluteString) } // target=_blank · window.open → Safari
        return nil
    }

    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        loadFailed(webView, error)
    }

    func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
        loadFailed(webView, error)
    }

    private func loadFailed(_ webView: WKWebView, _ error: Error) {
        let e = error as NSError
        print("[SKW] load failed: \(e.domain) \(e.code) \(e.localizedDescription)")
        if webView != web || (e.domain == NSURLErrorDomain && e.code == NSURLErrorCancelled) { return }
        if e.domain == "WebKitErrorDomain" && e.code == 102 { return } // 이동을 막은 것 (decidePolicyFor)
        showNotice(title: "load_title", body: NSLocalizedString("load_body", comment: ""))
    }

    /// 웹 프로세스가 죽으면(메모리 부족 · 충돌) 다시 불러온다. 30초 안에 3번이면 멈추고 안내
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) {
        guard webView == web else { return }
        let now = Self.clock()
        crashCount = now - lastCrash < Self.crashWindow ? crashCount + 1 : 1
        lastCrash = now
        print("[SKW] web content process terminated (\(crashCount))")
        if crashCount >= 3 {
            crashCount = 0
            showNotice(title: "crash_title", body: NSLocalizedString("crash_body", comment: ""))
        } else {
            loadGame()
        }
    }

    func webView(_ webView: WKWebView, runJavaScriptAlertPanelWithMessage message: String, initiatedByFrame frame: WKFrameInfo,
                 completionHandler: @escaping () -> Void) {
        let a = UIAlertController(title: nil, message: message, preferredStyle: .alert)
        a.addAction(UIAlertAction(title: "OK", style: .default) { _ in completionHandler() })
        if presentedViewController == nil { present(a, animated: true) } else { completionHandler() }
    }
}

/// skw://game/index.html → 고른 게임 HTML (메모리). 그 밖의 주소는 404
final class GameSchemeHandler: NSObject, WKURLSchemeHandler {
    var html = Data()

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return task.didFailWithError(URLError(.badURL)) }
        let path = url.path.isEmpty ? "/" : url.path
        let ok = url.host == GameViewController.host && (path == "/" || path == "/index.html")
        let body = ok ? html : Data()
        let headers = [
            "Content-Type": ok ? "text/html; charset=utf-8" : "text/plain; charset=utf-8",
            "Content-Length": String(body.count),
            "Cache-Control": "no-store",
        ]
        guard let r = HTTPURLResponse(url: url, statusCode: ok ? 200 : 404, httpVersion: "HTTP/1.1", headerFields: headers) else {
            return task.didFailWithError(URLError(.unknown))
        }
        task.didReceive(r)
        if !body.isEmpty { task.didReceive(body) }
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {
        // 답을 start 안에서 바로 다 주므로 멈출 것이 없다
    }
}

/// 메시지 처리기를 약하게 잡는다 (WKUserContentController 가 처리기를 강하게 잡아 생기는 순환 참조를 끊음)
private final class WeakBridge: NSObject, WKScriptMessageHandlerWithReply {
    weak var owner: GameViewController?
    init(_ owner: GameViewController) { self.owner = owner }

    func userContentController(_ userContentController: WKUserContentController, didReceive message: WKScriptMessage,
                               replyHandler: @escaping (Any?, String?) -> Void) {
        guard let owner else { return replyHandler(nil, "gone") }
        owner.onMessage(message, reply: replyHandler)
    }
}
