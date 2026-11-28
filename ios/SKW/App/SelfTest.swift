import AVFoundation
import UIKit
import WebKit

/// 자동 시험 (CI 의 Simulator 연기 시험 전용 — 실행 인자가 없으면 아무 일도 하지 않는다).
///
///   --skw-selftest                     켜기
///   --skw-selftest-out=<이름>          결과 파일 이름 (Library/Caches/skw-selftest-<이름>.json, 기본 main)
///   --skw-selftest-write=<값>          localStorage 'skw-selftest-nonce' 에 값을 쓴다 (다시 켰을 때 남아 있는지 보려고)
///   --skw-selftest-nogpu               navigator.gpu 를 지운 채로 (WebGPU 가 없는 기기의 안내 화면 시험)
///   --skw-selftest-file                skw:// 대신 file:// 로 띄운다 (보안 출처 비교용)
///   --skw-selftest-shell=<버전>        앱(껍데기) 번호를 이 값으로 속인다 (예 1.5.0 → 진짜 업데이트 주소에서 지금 게임을 받아 적용하는지 시험)
///   --skw-selftest-wait=<초>           켤 때 업데이트를 기다리는 시간 (기본 4초)
///
/// 게임이 뜨면(G.ready 또는 G.dead) 페이지 안에서 확인할 것을 모아 JSON 한 줄로 stdout 에 "SKW-SELFTEST {…}" 로 찍고 같은 내용을 파일로도 쓴다.
final class SelfTest {
    let name: String
    let write: String?
    let noGPU: Bool
    let serveFile: Bool
    var shellOverride: String?
    var startupWait: TimeInterval?
    private var attached = false
    private let t0 = Date()

    static func fromArguments(_ args: [String] = ProcessInfo.processInfo.arguments) -> SelfTest? {
        guard args.contains("--skw-selftest") else { return nil }
        let val = { (k: String) -> String? in args.first { $0.hasPrefix(k + "=") }.map { String($0.dropFirst(k.count + 1)) } }
        let t = SelfTest(name: val("--skw-selftest-out") ?? "main", write: val("--skw-selftest-write"),
                         noGPU: args.contains("--skw-selftest-nogpu"), serveFile: args.contains("--skw-selftest-file"))
        t.shellOverride = Updater.cleanVersion(val("--skw-selftest-shell"))
        t.startupWait = val("--skw-selftest-wait").flatMap { Double($0) }.map { min(max($0, 1), 120) }
        return t
    }

    init(name: String, write: String?, noGPU: Bool, serveFile: Bool) {
        self.name = name.filter { $0.isLetter || $0.isNumber || $0 == "-" }
        self.write = write
        self.noGPU = noGPU
        self.serveFile = serveFile
    }

    /// 게임 코드보다 먼저: JS 오류 모으기 (+ WebGPU 지우기)
    func userScripts() -> [WKUserScript] {
        var s = [WKUserScript(source: Self.collector, injectionTime: .atDocumentStart, forMainFrameOnly: true)]
        if noGPU { s.append(WKUserScript(source: Self.killGPU, injectionTime: .atDocumentStart, forMainFrameOnly: true)) }
        return s
    }

    func attach(to vc: GameViewController, web: WKWebView) {
        if attached { return }
        attached = true
        say("start \(name) write=\(write ?? "-") nogpu=\(noGPU) file=\(serveFile) shell=\(shellOverride ?? "-")")
        poll(vc, web, tries: 0)
    }

    /// 0.5초마다 게임이 떴는지 본다 (최대 180초). 뜬 뒤 2초 더 기다렸다가(처음 화면 그리기) 확인
    private func poll(_ vc: GameViewController, _ web: WKWebView, tries: Int) {
        web.evaluateJavaScript("!!(window.G&&(G.ready||G.dead))") { [weak self, weak vc, weak web] r, _ in
            guard let self, let vc, let web else { return }
            if (r as? Bool) == true || tries >= 360 {
                DispatchQueue.main.asyncAfter(deadline: .now() + 2) { self.run(vc, web, timedOut: tries >= 360) }
            } else {
                DispatchQueue.main.asyncAfter(deadline: .now() + 0.5) { self.poll(vc, web, tries: tries + 1) }
            }
        }
    }

    private func run(_ vc: GameViewController, _ web: WKWebView, timedOut: Bool) {
        web.callAsyncJavaScript(Self.probe, arguments: ["write": write.map { $0 as Any } ?? NSNull()], in: nil, in: .page) { [weak self, weak vc] res in
            guard let self, let vc else { return }
            var out: [String: Any] = [:]
            switch res {
            case .success(let v):
                if let s = v as? String, let d = s.data(using: .utf8), let o = try? JSONSerialization.jsonObject(with: d) as? [String: Any] {
                    out = o
                } else {
                    out["probeError"] = "bad result: \(String(describing: v))"
                }
            case .failure(let e):
                out["probeError"] = "\(e)"
            }
            out["name"] = self.name
            out["timedOut"] = timedOut
            out["seconds"] = Int(Date().timeIntervalSince(self.t0))
            out["native"] = self.native(vc)
            self.emit(out)
        }
    }

    /// 앱 쪽에서 본 값 (Info.plist · 화면 · 소리)
    private func native(_ vc: GameViewController) -> [String: Any] {
        let b = Bundle.main
        let scene = vc.view.window?.windowScene
        return [
            "bundleId": b.bundleIdentifier ?? "",
            "displayName": b.localizedInfoDictionary?["CFBundleDisplayName"] ?? b.object(forInfoDictionaryKey: "CFBundleDisplayName") ?? "",
            "shortVersion": b.object(forInfoDictionaryKey: "CFBundleShortVersionString") ?? "",
            "build": b.object(forInfoDictionaryKey: "CFBundleVersion") ?? "",
            "shellVersion": b.object(forInfoDictionaryKey: "SKWShellVersion") ?? "",
            "autoUpdate": GameViewController.autoUpdateEnabled,
            "served": ["version": vc.served.version, "label": vc.served.label, "downloaded": vc.served.downloaded],
            "audioCategory": AVAudioSession.sharedInstance().category.rawValue,
            "idleTimerDisabled": UIApplication.shared.isIdleTimerDisabled,
            "statusBarHidden": vc.prefersStatusBarHidden,
            "homeIndicatorAutoHidden": vc.prefersHomeIndicatorAutoHidden,
            "landscape": scene.map { $0.effectiveGeometry.interfaceOrientation.isLandscape } ?? false,
            "screen": vc.view.window.map { "\(Int($0.bounds.width))x\(Int($0.bounds.height))@\($0.traitCollection.displayScale)" } ?? "",
            "safeArea": vc.view.window.map { "\($0.safeAreaInsets)" } ?? "",
            "model": UIDevice.current.model,
            "system": "\(UIDevice.current.systemName) \(UIDevice.current.systemVersion)",
            "preferredLanguages": Locale.preferredLanguages.prefix(3).joined(separator: ","),
        ]
    }

    private func emit(_ o: [String: Any]) {
        let d = (try? JSONSerialization.data(withJSONObject: o, options: [.sortedKeys])) ?? Data("{}".utf8)
        let line = String(decoding: d, as: UTF8.self)
        say("result " + line)
        print("SKW-SELFTEST " + line)
        fflush(stdout)
        if let dir = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first {
            try? d.write(to: dir.appendingPathComponent("skw-selftest-\(name).json"), options: .atomic)
        }
    }

    private func say(_ s: String) {
        print("[SKW] selftest \(s)")
        fflush(stdout)
    }

    private static let collector = """
    (function(){var E=window.__skwSelfErr=[];var p=function(s){if(E.length<40)E.push(String(s).slice(0,300));};
    addEventListener('error',function(e){p('error '+e.message+' @'+String(e.filename||'').split('/').pop()+':'+e.lineno);});
    addEventListener('unhandledrejection',function(e){var r=e.reason;p('rejection '+(r&&(r.stack||r.message)||r));});
    var ce=console.error;console.error=function(){try{p('console.error '+[].map.call(arguments,String).join(' '));}catch(x){}return ce.apply(console,arguments);};})();
    """

    private static let killGPU = """
    (function(){try{Object.defineProperty(Navigator.prototype,'gpu',{configurable:true,get:function(){return undefined;}});}catch(e){}
    try{Object.defineProperty(navigator,'gpu',{configurable:true,get:function(){return undefined;}});}catch(e){}})();
    """

    /// 페이지 안에서 모으는 것 (callAsyncJavaScript 의 함수 몸통 — write 인자를 받는다)
    private static let probe = """
    const r = {};
    const T = (p, ms) => Promise.race([Promise.resolve(p), new Promise(res => setTimeout(() => res('__timeout'), ms))]);
    const wait = ms => new Promise(res => setTimeout(res, ms));
    r.href = location.href; r.origin = location.origin; r.isSecureContext = window.isSecureContext;
    r.gpuType = typeof navigator.gpu;
    try {
      const a = navigator.gpu ? await T(navigator.gpu.requestAdapter(), 15000) : null;
      r.adapter = a === '__timeout' ? 'timeout' : !!a;
      if (a && a !== '__timeout') { const i = a.info || {}; r.adapterInfo = { vendor: i.vendor, architecture: i.architecture, device: i.device, description: i.description }; }
    } catch (e) { r.adapter = false; r.adapterError = String(e); }
    r.cryptoSubtle = !!(window.crypto && crypto.subtle); r.decompressionStream = typeof DecompressionStream;
    const G = window.G, D = window.skwDesktop;
    r.G = !!G; r.ready = !!(G && G.ready); r.dead = !!(G && G.dead); r.frame = G ? G.frame : null;
    const fatal = document.getElementById('fatal');
    r.screen = fatal ? 'unsupported' : document.getElementById('ov') ? 'title' : 'none';
    r.fatal = fatal ? fatal.innerText.replace(/\\s+/g, ' ').slice(0, 400) : null;
    r.platform = D ? D.platform : null; r.shell = D ? D.version : null; r.gameVersion = D ? D.gameVersion : null; r.label = D ? D.label : null;
    r.gVersion = G ? G.VERSION : null; r.gLabel = G ? G.LABEL : null;
    r.hasUpdate = !!(D && D.update); r.touch = !!(G && G.touch && G.touch.on); r.lang = G && G.i18n ? G.i18n.lang : null;
    r.tier = G && G.Q ? G.Q.name : null; r.gpuName = G && G.gpuInfo ? G.gpuInfo.name : null;
    r.pauseHook = !!window.__skwIOS; r.audio = window.__skwIOS ? window.__skwIOS.audio() : null;
    if (D && D.update) {
      try {
        r.updateStatus = await T(D.update.status(), 5000);
        r.updateCheck = await T(D.update.check(), 90000);
        r.updateLog = String(await T(D.update.log(), 5000) || '').split('\\n').filter(Boolean).slice(-20);
      } catch (e) { r.updateError = String(e); }
    }
    try {
      if (G && G.desktop && document.getElementById('ov')) {
        G.desktop.settings('title'); await wait(400);
        const row = document.querySelector('#dk [data-k=up]');
        r.versionRow = row ? { shown: !!row.offsetParent, version: row.querySelector('output').textContent, text: row.querySelector('.us').textContent,
          buttons: [...row.querySelectorAll('button')].filter(b => b.offsetParent).map(b => b.textContent) } : null;
        const fs = document.querySelector('#dk [data-k=fs]'); r.fullscreenRowShown = !!(fs && fs.offsetParent);
        r.pauseQuitItem = !!document.querySelector('#dk [data-a=quit]');
        r.titleButtons = [...document.querySelectorAll('#ov .dkb button')].map(b => b.textContent);
        G.desktop.back(); await wait(100);
        r.menuClosed = !G.desktop.menu;
      }
    } catch (e) { r.settingsError = String(e); }
    const K = 'skw-selftest-nonce';
    try { r.lsBefore = localStorage.getItem(K); if (write) { localStorage.setItem(K, write); r.lsWritten = write; } r.lsKeys = Object.keys(localStorage).sort(); }
    catch (e) { r.lsError = String(e); }
    r.errors = (window.__skwSelfErr || []).slice(0, 20); r.gErrors = G && G.errors ? G.errors.slice(0, 10) : null;
    r.ua = navigator.userAgent; r.viewport = [innerWidth, innerHeight, devicePixelRatio];
    return JSON.stringify(r);
    """
}
