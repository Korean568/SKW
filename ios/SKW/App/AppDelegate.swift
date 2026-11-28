import AVFoundation
import UIKit

/// Second Korean Wars — iPhone · iPad 앱 (스토리 게임 HTML 한 파일을 WKWebView 하나에 띄운다. 본체는 GameViewController)
@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication,
                     didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // 소리: .ambient — 게임 효과음 · 대사용. 무음 스위치(벨소리 끔)를 따르고, 사용자가 듣던 음악을 끊지 않고 섞인다.
        // (Web Audio 는 WebKit 이 이 앱의 오디오 세션으로 낸다)
        do {
            try AVAudioSession.sharedInstance().setCategory(.ambient, mode: .default, options: [])
        } catch {
            print("[SKW] audio session: \(error)")
        }
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting connectingSceneSession: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        UISceneConfiguration(name: "Default Configuration", sessionRole: connectingSceneSession.role)
    }
}

/// 창 하나 (여러 창 없음). 앞에 있을 때만 화면 꺼짐(자동 잠금)을 막고, 게임에 일시정지 · 다시 시작을 알린다.
final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    private var game: GameViewController? { window?.rootViewController as? GameViewController }

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let ws = scene as? UIWindowScene else { return }
        let w = UIWindow(windowScene: ws)
        w.backgroundColor = GameViewController.background
        w.rootViewController = GameViewController()
        w.makeKeyAndVisible()
        window = w
    }

    func sceneDidBecomeActive(_ scene: UIScene) {
        UIApplication.shared.isIdleTimerDisabled = true // 게임 중 화면이 꺼지지 않게 (앞에 있는 동안만)
        try? AVAudioSession.sharedInstance().setActive(true)
        game?.didBecomeActive()
    }

    func sceneWillResignActive(_ scene: UIScene) {
        UIApplication.shared.isIdleTimerDisabled = false
        game?.willResignActive()
    }
}
