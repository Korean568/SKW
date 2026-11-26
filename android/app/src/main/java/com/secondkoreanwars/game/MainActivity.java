package com.secondkoreanwars.game;

import android.annotation.SuppressLint;
import android.annotation.TargetApi;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.ColorDrawable;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import android.window.OnBackInvokedDispatcher;

import androidx.webkit.WebViewAssetLoader;

import java.io.ByteArrayInputStream;
import java.util.HashMap;
import java.util.Locale;

/**
 * Second Korean Wars — Android 앱.
 *
 * 스토리 게임(HTML 한 파일, WebGPU)을 WebView 하나에 띄운다.
 *  - 게임 파일은 앱 안(assets/index.html)에 있고 https://appassets.androidplatform.net/assets/ 로 서빙한다
 *    (보안 출처여야 WebGPU · localStorage 가 동작한다). 네트워크는 쓰지 않는다 (INTERNET 권한 없음).
 *  - 게임과의 약속: window.skwDesktop (platform 'android') 은 assets 에 끼워 넣은 작은 스크립트
 *    (android/scripts/android-shim.js)가 아래 Bridge(window.SkwNative)를 감싸 만든다.
 *  - 뒤로 버튼: window.skwBack() 이 true 를 돌려주면 게임이 처리한 것, 아니면 "한 번 더 누르면 종료".
 */
public class MainActivity extends Activity {
    private static final String HOST = WebViewAssetLoader.DEFAULT_DOMAIN; // appassets.androidplatform.net
    private static final String START_URL = "https://" + HOST + "/assets/index.html";
    private static final String BRIDGE = "SkwNative";
    private static final String DEFAULT_WEBVIEW = "com.google.android.webview";
    private static final long EXIT_WINDOW_MS = 2000;   // 이 시간 안에 뒤로를 한 번 더 누르면 종료
    private static final long BACK_REPLY_MS = 800;     // 게임이 이 시간 안에 답하지 않으면 처리 안 한 것으로 봄
    private static final long CRASH_WINDOW_MS = 30000; // 이 시간 안에 렌더 프로세스가 3번 죽으면 자동 재시작을 멈춤

    private final Handler main = new Handler(Looper.getMainLooper());

    private FrameLayout root;
    private WebView web;
    private View notice;                 // 안내 화면 (WebGPU 없음 · 반복 충돌 · 불러오기 실패)
    private WebViewAssetLoader assets;
    private Toast toast;
    private String versionName = "";
    private boolean resumed;
    private long lastBackWarn = -EXIT_WINDOW_MS * 2;
    private long lastCrash = -CRASH_WINDOW_MS * 2;
    private int crashCount;
    private final Runnable pauseTimers = () -> {
        if (this.web != null && !this.resumed) this.web.pauseTimers();
    };

    /* ───────────────────────── 생명 주기 ───────────────────────── */

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            versionName = String.valueOf(getPackageManager().getPackageInfo(getPackageName(), 0).versionName);
        } catch (Exception e) {
            versionName = "";
        }

        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        w.setBackgroundDrawable(new ColorDrawable(Color.BLACK));
        w.setDecorFitsSystemWindows(false); // 가장자리까지 그리기 (게임이 env(safe-area-inset-*) 로 여백을 둔다)
        WindowManager.LayoutParams lp = w.getAttributes();
        lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
        w.setAttributes(lp);
        setVolumeControlStream(AudioManager.STREAM_MUSIC);

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        setContentView(root, new ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        assets = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();
        createWebView();
        hideSystemBars();

        if (Build.VERSION.SDK_INT >= 33) Api33.registerBack(this); // Android 13+: 새 뒤로 가기 방식
    }

    @Override
    protected void onResume() {
        super.onResume();
        resumed = true;
        main.removeCallbacks(pauseTimers);
        hideSystemBars();
        if (web != null) {
            web.resumeTimers();
            web.onResume();
            js("window.__skwAndroid&&window.__skwAndroid.resume()");
        }
    }

    @Override
    protected void onPause() {
        resumed = false;
        if (web != null) {
            // 일시정지 메뉴를 띄우고 소리를 멈춘 다음(페이지 안에서) WebView 를 멈춘다
            js("window.__skwAndroid&&window.__skwAndroid.pause()");
            web.onPause();
            main.postDelayed(pauseTimers, 300); // 위 스크립트가 돌 시간을 준 뒤 타이머까지 멈춤
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        main.removeCallbacksAndMessages(null);
        if (web != null) web.resumeTimers(); // pauseTimers 는 프로세스 전체에 걸리므로 되돌려 둔다
        destroyWebView();
        super.onDestroy();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    /** 상태 막대 · 내비게이션 막대 숨기기 (가장자리를 쓸면 잠깐 나왔다가 다시 숨는다). */
    private void hideSystemBars() {
        WindowInsetsController c = getWindow().getInsetsController();
        if (c == null) return;
        c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        c.hide(WindowInsets.Type.systemBars());
    }

    /* ───────────────────────── WebView ───────────────────────── */

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    private void createWebView() {
        WebView v = new WebView(this);
        v.setBackgroundColor(Color.BLACK);
        v.setOverScrollMode(View.OVER_SCROLL_NEVER);
        v.setVerticalScrollBarEnabled(false);
        v.setHorizontalScrollBarEnabled(false);
        v.setHapticFeedbackEnabled(false);
        v.setOnLongClickListener(x -> true); // 길게 눌러도 글자 선택 · 메뉴가 뜨지 않게
        v.setFocusable(true);
        v.setFocusableInTouchMode(true);

        WebSettings s = v.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);                  // localStorage: 설정 · 진행 저장
        s.setMediaPlaybackRequiresUserGesture(false);  // 소리를 터치 없이도 낼 수 있게
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setUseWideViewPort(true);                    // <meta name="viewport"> 를 Chrome 처럼 따른다
        s.setLoadWithOverviewMode(false);
        s.setTextZoom(100);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setGeolocationEnabled(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSafeBrowsingEnabled(false);               // 네트워크를 쓰지 않는다

        v.addJavascriptInterface(new Bridge(), BRIDGE);
        v.setWebViewClient(new Client());
        v.setWebChromeClient(new WebChromeClient());

        root.addView(v, 0, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        web = v;
        v.loadUrl(START_URL);
        v.requestFocus();
    }

    private void destroyWebView() {
        WebView v = web;
        web = null;
        if (v == null) return;
        root.removeView(v);
        v.removeJavascriptInterface(BRIDGE);
        v.setWebViewClient(new WebViewClient());
        v.destroy();
    }

    private void js(String code) {
        if (web != null) web.evaluateJavascript(code, null);
    }

    private static boolean isAppUrl(Uri u) {
        return u != null && "https".equalsIgnoreCase(u.getScheme()) && HOST.equalsIgnoreCase(u.getHost());
    }

    private final class Client extends WebViewClient {
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (isAppUrl(u)) {
                WebResourceResponse r = assets.shouldInterceptRequest(u);
                if (r == null) return empty(404, "Not Found");
                if ("text/html".equals(r.getMimeType())) r.setEncoding("UTF-8");
                return r;
            }
            String scheme = u == null ? null : u.getScheme();
            if ("data".equals(scheme) || "blob".equals(scheme) || "about".equals(scheme)) return null;
            return empty(403, "Blocked"); // 앱 밖 주소는 불러오지 않는다
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri u = request.getUrl();
            if (isAppUrl(u)) return false;
            // 앱 밖으로 가는 이동은 막고, 사용자가 누른 http/https 링크만 시스템 브라우저로 넘긴다
            if (u != null && request.hasGesture()) openExternal(u.toString());
            return true;
        }

        @Override
        public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
            if (view == web && request.isForMainFrame()) {
                showNotice(R.string.load_title, getString(R.string.load_body), false, true);
            }
        }

        @Override
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            // 렌더 프로세스가 죽으면(메모리 부족 · 충돌) 이 WebView 는 더 쓸 수 없다 → 새로 만든다
            if (view == web) main.post(MainActivity.this::onRendererGone);
            return true;
        }
    }

    private static WebResourceResponse empty(int status, String reason) {
        return new WebResourceResponse("text/plain", "UTF-8", status, reason, new HashMap<>(), new ByteArrayInputStream(new byte[0]));
    }

    private void onRendererGone() {
        if (isFinishing() || isDestroyed()) return;
        long now = SystemClock.elapsedRealtime();
        crashCount = now - lastCrash < CRASH_WINDOW_MS ? crashCount + 1 : 1;
        lastCrash = now;
        destroyWebView();
        if (crashCount >= 3) {
            crashCount = 0;
            showNotice(R.string.crash_title, getString(R.string.crash_body), false, true);
        } else {
            hideNotice();
            createWebView();
            if (!resumed && web != null) web.onPause(); // 백그라운드에서 죽었으면 돌아올 때까지 멈춰 둔다
        }
    }

    /* ───────────────────────── 게임 ↔ 앱 다리 (window.SkwNative) ───────────────────────── */

    /** 페이지의 자바스크립트가 부른다 (WebView 의 별도 스레드에서 불리므로 화면 작업은 main 으로 넘김). */
    public final class Bridge {
        @JavascriptInterface
        public String version() {
            return versionName;
        }

        @JavascriptInterface
        public void quit() {
            main.post(MainActivity.this::finish);
        }

        @JavascriptInterface
        public void openExternal(String url) {
            main.post(() -> MainActivity.this.openExternal(url));
        }

        /** "none" = navigator.gpu 없음, "noadapter" = 어댑터를 얻지 못함. */
        @JavascriptInterface
        public void gpuStatus(String status) {
            main.post(() -> onGpuStatus(status));
        }
    }

    /** http/https 주소만 시스템 브라우저로 연다. */
    private void openExternal(String url) {
        if (url == null) return;
        Uri u = Uri.parse(url.trim());
        String scheme = u.getScheme() == null ? "" : u.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) return;
        if (u.getHost() == null || isAppUrl(u)) return;
        Intent i = new Intent(Intent.ACTION_VIEW, u);
        i.addCategory(Intent.CATEGORY_BROWSABLE);
        i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(i);
        } catch (RuntimeException e) { // ActivityNotFoundException · SecurityException
            showToast(R.string.no_browser);
        }
    }

    private void onGpuStatus(String status) {
        if (isFinishing() || isDestroyed() || notice != null) return;
        PackageInfo p = WebView.getCurrentWebViewPackage();
        String wv = p == null ? getString(R.string.webview_unknown) : p.packageName + " " + p.versionName;
        String body = getString("none".equals(status) ? R.string.gpu_none : R.string.gpu_noadapter)
                + "\n\n" + getString(R.string.webview_current, wv)
                + "\nAndroid " + Build.VERSION.RELEASE + " (API " + Build.VERSION.SDK_INT + ") · " + Build.MANUFACTURER + " " + Build.MODEL;
        showNotice(R.string.gpu_title, body, true, false);
    }

    private void openWebViewInStore() {
        PackageInfo p = WebView.getCurrentWebViewPackage();
        String pkg = p == null || p.packageName == null ? DEFAULT_WEBVIEW : p.packageName;
        Intent market = new Intent(Intent.ACTION_VIEW, Uri.parse("market://details?id=" + pkg));
        market.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            startActivity(market);
        } catch (RuntimeException e) { // Play 스토어 앱이 없으면 웹 주소로
            openExternal("https://play.google.com/store/apps/details?id=" + pkg);
        }
    }

    /* ───────────────────────── 안내 화면 ───────────────────────── */

    private void showNotice(int titleRes, String body, boolean storeButton, boolean retryButton) {
        hideNotice();
        int pad = dp(24);

        LinearLayout box = new LinearLayout(this);
        box.setOrientation(LinearLayout.VERTICAL);
        box.setGravity(Gravity.CENTER);
        box.setPadding(pad, pad, pad, pad);

        TextView title = new TextView(this);
        title.setText(titleRes);
        title.setTextColor(0xFFFF8A5C);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        box.addView(title, wrap(0));

        TextView text = new TextView(this);
        text.setText(body);
        text.setTextColor(0xFFDFE8F2);
        text.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        text.setLineSpacing(dp(3), 1f);
        text.setTextIsSelectable(true);
        box.addView(text, wrap(dp(14)));

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        row.setGravity(Gravity.CENTER);
        if (storeButton) row.addView(button(R.string.btn_update_webview, x -> openWebViewInStore()), wrap(0));
        if (retryButton) row.addView(button(R.string.btn_retry, x -> retry()), wrap(0));
        row.addView(button(R.string.btn_exit, x -> finish()), wrap(0));
        box.addView(row, wrap(dp(18)));

        ScrollView scroll = new ScrollView(this);
        scroll.setFillViewport(true);
        scroll.setBackgroundColor(0xF205080C);
        scroll.setClickable(true); // 아래 게임 화면으로 터치가 새지 않게
        FrameLayout.LayoutParams inner = new FrameLayout.LayoutParams(dp(560), ViewGroup.LayoutParams.WRAP_CONTENT, Gravity.CENTER);
        scroll.addView(box, inner);

        root.addView(scroll, new FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        notice = scroll;
    }

    private void hideNotice() {
        if (notice != null) {
            root.removeView(notice);
            notice = null;
        }
    }

    private void retry() {
        hideNotice();
        destroyWebView();
        createWebView();
    }

    private Button button(int textRes, View.OnClickListener onClick) {
        Button b = new Button(this);
        b.setText(textRes);
        b.setAllCaps(false);
        b.setOnClickListener(onClick);
        return b;
    }

    private LinearLayout.LayoutParams wrap(int topMargin) {
        LinearLayout.LayoutParams p = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.WRAP_CONTENT, ViewGroup.LayoutParams.WRAP_CONTENT);
        p.topMargin = topMargin;
        p.leftMargin = dp(6);
        p.rightMargin = dp(6);
        return p;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    private void showToast(int textRes) {
        if (toast != null) toast.cancel();
        toast = Toast.makeText(this, textRes, Toast.LENGTH_SHORT);
        toast.show();
    }

    /* ───────────────────────── 뒤로 버튼 ───────────────────────── */

    /** Android 12 (API 31·32) 는 이 경로, Android 13+ 는 Api33.registerBack 의 콜백으로 들어온다. */
    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        handleBack();
    }

    /**
     * 게임에 먼저 묻는다: window.skwBack() 이 true 면 게임이 처리(일시정지 메뉴 열기/닫기 · 메뉴 한 단계 뒤로).
     * false 이거나 함수가 없으면(타이틀 화면) "한 번 더 누르면 종료됩니다" → 2초 안에 다시 누르면 종료.
     */
    void handleBack() {
        if (notice != null || web == null) {
            exitOrWarn();
            return;
        }
        final boolean[] answered = {false};
        final Runnable noReply = () -> {
            if (answered[0]) return;
            answered[0] = true;
            exitOrWarn();
        };
        main.postDelayed(noReply, BACK_REPLY_MS);
        web.evaluateJavascript(
                "(function(){try{return typeof window.skwBack==='function'?!!window.skwBack():false}catch(e){return false}})()",
                value -> {
                    if (answered[0]) return;
                    answered[0] = true;
                    main.removeCallbacks(noReply);
                    if (!"true".equals(value)) exitOrWarn();
                });
    }

    private void exitOrWarn() {
        long now = SystemClock.elapsedRealtime();
        if (now - lastBackWarn < EXIT_WINDOW_MS) {
            if (toast != null) toast.cancel();
            finish();
            return;
        }
        lastBackWarn = now;
        showToast(R.string.back_again);
    }

    /** API 33 에서 생긴 클래스는 여기서만 쓴다 (Android 12 기기가 이 클래스를 읽지 않게). */
    @TargetApi(33)
    private static final class Api33 {
        static void registerBack(MainActivity a) {
            a.getOnBackInvokedDispatcher().registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, a::handleBack);
        }
    }
}
