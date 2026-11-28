// CI 진단 (ios.yml): 러너 Mac 자체(가상 머신)의 Metal 장치와 macOS WKWebView 의 WebGPU 어댑터를 찍는다.
// Simulator 에서 requestAdapter() 가 null 일 때, 그것이 앱 문제인지 러너(가상 GPU) 문제인지 가리려고.
//   swiftc -O ios/scripts/webgpu-host-probe.swift -o probe && ./probe
import AppKit
import Metal
import WebKit

let dev = MTLCreateSystemDefaultDevice()
print("HOST-METAL device=\(dev?.name ?? "none") apple7=\(dev?.supportsFamily(.apple7) ?? false) "
      + "apple9=\(dev?.supportsFamily(.apple9) ?? false) mac2=\(dev?.supportsFamily(.mac2) ?? false) "
      + "metal3=\(dev?.supportsFamily(.metal3) ?? false)")

final class Probe: NSObject, WKNavigationDelegate {
    let web = WKWebView(frame: NSRect(x: 0, y: 0, width: 320, height: 200), configuration: WKWebViewConfiguration())

    func start() {
        web.navigationDelegate = self
        web.loadHTMLString("<!doctype html><title>probe</title>", baseURL: URL(string: "https://localhost/"))
    }

    func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
        let js = """
        const r = { secure: isSecureContext, gpu: typeof navigator.gpu, ua: navigator.userAgent };
        try {
          const a = navigator.gpu ? await navigator.gpu.requestAdapter() : null;
          r.adapter = !!a;
          if (a) { const i = a.info || {}; r.info = [i.vendor, i.architecture, i.description].filter(Boolean).join(' '); r.features = [...a.features].length; }
        } catch (e) { r.error = String(e); }
        return JSON.stringify(r);
        """
        webView.callAsyncJavaScript(js, arguments: [:], in: nil, in: .page) { res in
            switch res {
            case .success(let v): print("HOST-WEBGPU \(v)")
            case .failure(let e): print("HOST-WEBGPU error \(e)")
            }
            exit(0)
        }
    }
}

let app = NSApplication.shared
app.setActivationPolicy(.accessory)
let probe = Probe()
probe.start()
DispatchQueue.main.asyncAfter(deadline: .now() + 40) {
    print("HOST-WEBGPU timeout")
    exit(2)
}
app.run()
