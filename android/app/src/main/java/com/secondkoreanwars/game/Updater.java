package com.secondkoreanwars.game;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.ConnectException;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.NoRouteToHostException;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.ExecutorCompletionService;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicReference;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.GZIPInputStream;

import javax.net.ssl.SSLException;

/**
 * 게임 자동 업데이트 — PC판(desktop/main.js)과 같은 파일(desktop/update/latest.json + game.gz) · 같은 규칙.
 *
 *  - 모든 주소(BASES)에 latest.json 을 동시에 묻고, 그중 가장 높은 버전을 고른다 (한 주소가 실패하거나 옛것을 알려 줘도 나머지를 본다).
 *    쓸 수 있는 새 버전을 알려 준 주소가 있으면 나머지는 1초(GRACE_MS)만 더 기다리고 받기 시작한다 (PC판과 같이).
 *  - 이 앱이 띄울 수 있고(minShell ≤ 앱 버전) 지금 게임 · 이미 받아 둔 게임보다 새것일 때만 game.gz 를 받는다 (낮은 버전으로 내려가지 않음).
 *  - 풀어서(gzip) sha256 이 맞을 때만 filesDir/game/ 에 저장: game-<버전>.html 을 먼저 쓰고(임시 파일 → rename),
 *    마지막에 version.json 을 바꿔 가리키게 한다 → 반쯤 받은 파일이 멀쩡한 게임을 덮지 않는다.
 *    켤 때도 version.json 의 sha256 으로 파일을 다시 확인한다 (어긋나면 앱에 든 게임으로 시작).
 *  - 확인은 한 번에 하나만 (worker 스레드 하나). 네트워크는 net 스레드에서, 시간 제한 · 한 번 다시 시도.
 *  - 기록: filesDir/update.log (약 200줄까지) — 소유자 기기에서 왜 안 되는지 알아보려고.
 *  - 게임에 넘기는 상태 S (skwDesktop.update 약속, android-shim.js):
 *      { state: idle|checking|downloading|ready|latest|error, current:{version,label}, latest:{version,label}|null,
 *        error: 짧은 이유|null, at: 마지막으로 끝난 확인 시각(ms), applied: 켤 때 새로 받은 게임으로 바꿨는가, seq: 확인 번호, shell }
 *
 * android.* 를 쓰지 않는다 → 같은 파일을 PC 의 JDK 로 컴파일해 가짜 서버로 시험할 수 있다 (org.json 은 Android 에 들어 있음).
 */
final class Updater {
    static final String[] BASES = {
            "https://raw.githubusercontent.com/Korean568/SKW/main/desktop/update/",
            "https://korean568.github.io/SKW/desktop/update/",
    };
    static final long LATEST_MS = 10_000, GAME_MS = 90_000, BACKOFF_MS = 1_500, GRACE_MS = 1_000;
    private static final int MAX_JSON = 64 * 1024, MAX_GZ = 16 << 20, MAX_HTML = 32 << 20; // 게임은 1~2 MB
    private static final int LOG_LINES = 200, LOG_TRIM_BYTES = 16 * 1024;
    private static final Pattern VERSION = Pattern.compile("^\\d{1,6}(\\.\\d{1,6}){0,3}$");
    private static final Pattern LABEL = Pattern.compile("^[0-9A-Za-z.+-]{1,24}$");
    private static final Pattern SHA = Pattern.compile("^[0-9a-f]{64}$");
    private static final Pattern FILE = Pattern.compile("^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$");

    /** 상태가 바뀔 때마다 불린다 (아무 스레드에서나, Updater 의 잠금 안에서 — 금방 끝낼 것). json = S, done = 확인 중이 아님 */
    interface Listener {
        void onStatus(String json, boolean done);
    }

    /** 받아 둔 게임 한 벌 (바뀌지 않음) */
    static final class Game {
        final String version, label, minShell, sha256;
        final File file;

        Game(String version, String label, String minShell, String sha256, File file) {
            this.version = version;
            this.label = label;
            this.minShell = minShell;
            this.sha256 = sha256;
            this.file = file;
        }
    }

    /** 주소 하나가 알려 준 latest.json */
    static final class Manifest {
        final String base, version, label, file, sha256, minShell;

        Manifest(String base, String version, String label, String file, String sha256, String minShell) {
            this.base = base;
            this.version = version;
            this.label = label;
            this.file = file;
            this.sha256 = sha256;
            this.minShell = minShell;
        }
    }

    /** 우리가 정한 짧은 실패 이유 (HTTP 404 · sha256 · minShell …) */
    static final class Fail extends IOException {
        private static final long serialVersionUID = 1L;

        Fail(String code) {
            super(code);
        }
    }

    final File dir, gameDir, logFile;
    final String shell, bundledVersion, bundledLabel;
    long latestMs = LATEST_MS, gameMs = GAME_MS, backoffMs = BACKOFF_MS, graceMs = GRACE_MS; // 시험할 때만 줄인다
    private final String[] bases;
    private final Listener listener;
    private final ExecutorService worker = Executors.newSingleThreadExecutor(daemon("skw-update"));
    private final ExecutorService net = Executors.newCachedThreadPool(daemon("skw-update-net"));
    private final Object lock = new Object(), logLock = new Object();

    private volatile Game current; // 지금 띄우는 받은 게임 (null = 앱에 든 게임) — WebView 스레드도 읽는다
    private Game ready;            // 받아서 확인했고 apply() 나 다음 시작 때 쓸 게임 (아래는 모두 lock 으로 보호)
    private String state = "idle", error, latestVersion, latestLabel;
    private long at;
    private int seq;
    private boolean applied, busy, closed;

    Updater(File dataDir, String[] bases, String shell, String bundledVersion, String bundledLabel, Listener listener) {
        this.dir = dataDir;
        this.gameDir = new File(dataDir, "game");
        this.logFile = new File(dataDir, "update.log");
        this.bases = bases.clone();
        this.shell = shell;
        this.bundledVersion = bundledVersion;
        this.bundledLabel = bundledLabel == null ? "" : bundledLabel;
        this.listener = listener;
    }

    private static ThreadFactory daemon(String name) {
        return r -> {
            Thread t = new Thread(r, name);
            t.setDaemon(true);
            return t;
        };
    }

    /* ───────────────────────── 버전 ───────────────────────── */

    private static int[] vnum(String v) {
        String[] p = String.valueOf(v).split("\\.");
        int[] n = new int[p.length];
        for (int i = 0; i < p.length; i++) {
            int k = 0, x = 0;
            while (k < p[i].length() && k < 9 && Character.isDigit(p[i].charAt(k))) x = x * 10 + (p[i].charAt(k++) - '0');
            n[i] = x;
        }
        return n;
    }

    /** 1.6.0 꼴 비교 (빈 자리 = 0): a > b 면 양수 */
    static int compare(String a, String b) {
        int[] x = vnum(a), y = vnum(b);
        for (int i = 0; i < Math.max(x.length, y.length); i++) {
            int p = i < x.length ? x[i] : 0, q = i < y.length ? y[i] : 0;
            if (p != q) return p > q ? 1 : -1;
        }
        return 0;
    }

    static boolean newer(String a, String b) {
        return compare(a, b) > 0;
    }

    static String cleanVersion(Object v) {
        return v instanceof String && VERSION.matcher((String) v).matches() ? (String) v : null;
    }

    static String cleanLabel(Object v) {
        return v instanceof String && LABEL.matcher((String) v).matches() ? (String) v : "";
    }

    private static String cleanSha(Object v) {
        if (!(v instanceof String)) return null;
        String s = ((String) v).toLowerCase(Locale.ROOT);
        return SHA.matcher(s).matches() ? s : null;
    }

    /* ───────────────────────── 지금 게임 · 받아 둔 게임 ───────────────────────── */

    /** 지금 띄울 받은 게임 (null = 앱에 든 게임) */
    Game current() {
        return current;
    }

    /**
     * filesDir/game 의 게임: 앱에 든 것보다 새것 · 이 앱이 띄울 수 있음(minShell) · 내용이 sha256 과 같을 때만. 아니면 null.
     */
    Game stored() {
        File vf = new File(gameDir, "version.json");
        if (!vf.isFile()) return null;
        try {
            JSONObject m = new JSONObject(new String(readFile(vf, MAX_JSON), StandardCharsets.UTF_8));
            String v = cleanVersion(m.opt("version")), sha = cleanSha(m.opt("sha256")), ms = cleanVersion(m.opt("minShell"));
            Object f = m.opt("file");
            if (v == null || sha == null || !(f instanceof String) || !FILE.matcher((String) f).matches()) throw new Fail("version.json");
            if (!newer(v, bundledVersion)) return null; // 앱을 새로 설치해 앱에 든 게임이 같거나 더 새것
            if (ms != null && newer(ms, shell)) throw new Fail("minShell " + ms);
            File hf = new File(gameDir, (String) f);
            if (!hf.isFile()) throw new Fail("파일 없음");
            if (!sha.equals(hex(sha256(readFile(hf, MAX_HTML))))) throw new Fail("sha256");
            return new Game(v, cleanLabel(m.opt("label")), ms == null ? "0" : ms, sha, hf);
        } catch (IOException | JSONException e) {
            log("받아 둔 게임을 쓰지 않음: " + reason(e));
            return null;
        }
    }

    /** 켤 때 (UI 스레드, 게임을 띄우기 전): 받아 둔 게임이 앱에 든 것보다 새것이면 그걸 띄운다. 안 쓰는 파일은 지운다. */
    void useCached() {
        Game g = stored();
        File[] fs = gameDir.listFiles();
        if (fs != null) for (File f : fs) {
            if (g != null && (f.equals(g.file) || f.getName().equals("version.json"))) continue;
            if (!f.delete()) log("지우지 못함: " + f.getName());
        }
        boolean first = g != null && announce(g.version);
        synchronized (lock) {
            if (g != null) {
                current = g;
                ready = null;
                applied = first;
            }
        }
        log("켬: 앱 " + shell + " · 게임 " + (g != null ? g.version + " (받은 것" + (first ? ", 처음" : "") + ")" : bundledVersion + " (앱에 든 것)"));
    }

    /** 이 버전을 처음 띄우는가 (그러면 게임이 "새 버전으로 업데이트했습니다" 를 보여 준다) */
    private boolean announce(String v) {
        File f = new File(dir, "update-seen");
        try {
            if (f.isFile() && v.equals(new String(readFile(f, 64), StandardCharsets.UTF_8).trim())) return false;
        } catch (IOException e) { /* 처음 */ }
        try {
            writeAtomic(f, v.getBytes(StandardCharsets.UTF_8));
        } catch (IOException e) { /* 다음에 한 번 더 알려 줄 뿐 */ }
        return true;
    }

    /** 준비된(ready) 게임으로 바꾼다. 페이지를 다시 불러오는 것은 부른 쪽 (켜기 전이면 그대로 시작). false = 준비된 게임 없음 */
    boolean apply() {
        synchronized (lock) {
            if (closed || ready == null || !"ready".equals(state)) return false;
        }
        Game g = stored(); // 파일이 그대로인지 다시 확인 (sha256)
        boolean ok;
        synchronized (lock) {
            ok = g != null && ready != null && "ready".equals(state) && g.version.equals(ready.version);
            if (ok) {
                current = g;
                ready = null;
                state = "latest";
                error = null;
                applied = true;
                latestVersion = g.version;
                latestLabel = g.label;
            } else if (ready != null && "ready".equals(state)) {
                ready = null;
                state = "error";
                error = "sha256";
            }
            notifyStatus(true);
        }
        if (ok) announce(g.version);
        log(ok ? "새 게임 " + g.version + " 으로 바꿈" : "바꾸지 못함: 받아 둔 파일이 없거나 바뀜");
        return ok;
    }

    /** 받은 게임 HTML + 다리 스크립트 (prepare-assets.js 와 똑같이). 못 읽으면 null → 앱에 든 게임 (WebView 스레드에서 불림) */
    String gameHtml(Game g, String shim) {
        try {
            String html = inject(new String(readFile(g.file, MAX_HTML), StandardCharsets.UTF_8), shim, g.version, g.label, shell);
            if (html != null) return html;
            log("받은 게임 " + g.version + ": <head> 가 없음 → 앱에 든 게임");
        } catch (IOException e) {
            log("받은 게임 " + g.version + " 을 읽지 못함 (" + reason(e) + ") → 앱에 든 게임");
        }
        synchronized (lock) {
            if (current == g) current = null;
        }
        return null;
    }

    /* ───────────────────────── 확인 ───────────────────────── */

    /** 확인을 시작한다. 돌려주는 값 = 이 확인의 번호 (이미 확인 중이면 그 번호, 끝난 뒤(close)라 못 하면 0) */
    int check(String why) {
        int id;
        synchronized (lock) {
            if (closed) return 0;
            if (busy) return seq;
            busy = true;
            id = ++seq;
            state = "checking";
            error = null;
            notifyStatus(false);
        }
        try {
            worker.execute(() -> run(why));
        } catch (RuntimeException e) { // RejectedExecutionException: 이미 닫힘
            synchronized (lock) {
                busy = false;
                state = "error";
                error = "closed";
                notifyStatus(true);
            }
            return 0;
        }
        return id;
    }

    boolean busy() {
        synchronized (lock) {
            return busy;
        }
    }

    private void run(String why) {
        long t0 = System.currentTimeMillis();
        try {
            runCheck(why);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            finish("error", "closed", null, null);
        } catch (RuntimeException e) {
            log("오류: " + e);
            finish("error", "bug", null, null);
        } finally {
            String s;
            synchronized (lock) {
                s = state + (error != null ? " (" + error + ")" : "") + (latestVersion != null ? " · " + latestVersion : "");
            }
            log("결과: " + s + " · " + (System.currentTimeMillis() - t0) + "ms");
            synchronized (lock) { // busy 를 풀면서 마지막 상태를 같은 순간에 알린다 (그 사이에 들어온 check() 와 순서가 섞이지 않게)
                busy = false;
                at = System.currentTimeMillis();
                notifyStatus(true);
            }
        }
    }

    private void runCheck(String why) throws InterruptedException {
        Game cur = current;
        String curV = cur != null ? cur.version : bundledVersion, curL = cur != null ? cur.label : bundledLabel;
        log("확인 (" + why + "): 지금 게임 " + curV + " · 앱 " + shell);
        Game have;
        synchronized (lock) {
            have = ready; // 확인 중에는 state 가 ready 가 아니라 apply() 가 되지 않는다 → 끝까지 그대로
        }
        String haveV = have != null && newer(have.version, curV) ? have.version : curV;

        // 1) 모든 주소에 동시에 latest.json — 온 순서대로 본다. 쓸 수 있는 새 버전이 오면 나머지는 graceMs 만 더 기다린다
        //    (한 주소가 말없이 막혀도(학교 와이파이 등) 그 주소의 시간 제한 · 다시 시도(약 21초)를 다 기다리지 않고 받기 시작)
        ExecutorCompletionService<Manifest> cs = new ExecutorCompletionService<>(net);
        Map<Future<Manifest>, Integer> asks = new LinkedHashMap<>();
        for (int i = 0; i < bases.length; i++) {
            String b = bases[i];
            asks.put(cs.submit(() -> manifest(b)), i);
        }
        Manifest[] ans = new Manifest[bases.length];
        String[] bad = new String[bases.length];
        long end = System.currentTimeMillis() + latestMs * 2 + backoffMs + 5000;
        boolean found = false;
        for (long w; !asks.isEmpty() && (w = end - System.currentTimeMillis()) > 0; ) {
            Future<Manifest> f = cs.poll(w, TimeUnit.MILLISECONDS);
            if (f == null) break;
            int i = asks.remove(f);
            String h = host(bases[i]);
            try {
                Manifest m = ans[i] = f.get();
                log(h + " latest.json: " + m.version + (m.label.isEmpty() ? "" : " (" + m.label + ")") + " · minShell " + m.minShell);
                if (!found && !newer(m.minShell, shell) && newer(m.version, haveV)) {
                    found = true;
                    end = Math.min(end, System.currentTimeMillis() + graceMs);
                }
            } catch (ExecutionException e) {
                bad[i] = reason(e.getCause());
                log(h + " latest.json 실패: " + bad[i]);
            }
        }
        for (Map.Entry<Future<Manifest>, Integer> e : asks.entrySet()) { // 시간 안에 답하지 않은 주소
            e.getKey().cancel(true);
            bad[e.getValue()] = "timeout";
            log(host(bases[e.getValue()]) + " latest.json " + (found ? "아직 답이 없음 → 기다리지 않고 받기 시작 (다음 확인 때 다시)" : "실패: timeout"));
        }
        List<Manifest> got = new ArrayList<>(); // 주소 순서대로 (답이 온 순서가 아니라)
        LinkedHashSet<String> errs = new LinkedHashSet<>();
        for (int i = 0; i < bases.length; i++) {
            if (ans[i] != null) got.add(ans[i]);
            else if (bad[i] != null) errs.add(bad[i]);
        }

        // 2) 가장 높은 버전 (이 앱이 띄울 수 있는 것 중) — 같으면 앞의 주소
        Manifest best = null, blocked = null;
        for (Manifest m : got) {
            if (newer(m.minShell, shell)) {
                if (blocked == null || newer(m.version, blocked.version)) blocked = m;
            } else if (best == null || newer(m.version, best.version)) best = m;
        }

        if (best != null && newer(best.version, haveV)) {
            // 3) 받기: 그 버전을 알려 준 주소부터, 안 되면 같은 버전 · 같은 sha256 을 알려 준 다른 주소
            synchronized (lock) {
                state = "downloading";
                latestVersion = best.version;
                latestLabel = best.label;
                notifyStatus(false);
            }
            List<Manifest> from = new ArrayList<>();
            from.add(best);
            for (Manifest m : got) if (m != best && m.version.equals(best.version) && m.sha256.equals(best.sha256)) from.add(m);
            String err = null;
            for (Manifest m : from) {
                try {
                    byte[] html = download(m);
                    Game g = save(m, html);
                    log(host(m.base) + " " + m.file + " " + m.version + ": 받음 " + html.length + " B · sha256 맞음 · 저장");
                    finish("ready", null, g, g);
                    return;
                } catch (IOException e) {
                    err = reason(e);
                    log(host(m.base) + " " + m.file + " " + m.version + " 실패: " + err);
                }
            }
            if (have != null && newer(have.version, curV)) finish("ready", null, have, have);
            else finish("error", err, null, null);
        } else if (have != null && newer(have.version, curV)) {
            finish("ready", null, have, have); // 전에 받아 둔 것이 아직 가장 새것
        } else if (blocked != null && newer(blocked.version, curV)) {
            log("새 게임 " + blocked.version + " 은 앱 " + blocked.minShell + " 이상이 필요 (지금 앱 " + shell + ") → 새 APK 필요");
            synchronized (lock) {
                latestVersion = blocked.version;
                latestLabel = blocked.label;
            }
            finish("error", "minShell", null, null);
        } else if (got.isEmpty()) {
            finish("error", errs.isEmpty() ? "offline" : join(errs), null, null);
        } else {
            synchronized (lock) {
                latestVersion = curV;
                latestLabel = curL;
            }
            finish("latest", null, null, null);
        }
    }

    /** 확인 결과를 상태에 넣는다 (ready 면 game = 준비된 게임, show = S.latest 로 보일 게임) */
    private void finish(String st, String err, Game game, Game show) {
        synchronized (lock) {
            state = st;
            error = err;
            if (game != null) ready = game;
            if (show != null) {
                latestVersion = show.version;
                latestLabel = show.label;
            }
        }
    }

    private Manifest manifest(String base) throws IOException, InterruptedException {
        byte[] b = getRetry("latest.json", base + "latest.json", latestMs, MAX_JSON);
        JSONObject j;
        try {
            j = new JSONObject(new String(b, StandardCharsets.UTF_8));
        } catch (JSONException e) {
            throw new Fail("bad json");
        }
        String v = cleanVersion(j.opt("version")), sha = cleanSha(j.opt("sha256")), ms = cleanVersion(j.opt("minShell"));
        Object f = j.opt("file");
        if (f == null || JSONObject.NULL.equals(f)) f = "game.gz";
        if (v == null || sha == null || !(f instanceof String) || !FILE.matcher((String) f).matches()) throw new Fail("bad json");
        return new Manifest(base, v, cleanLabel(j.opt("label")), (String) f, sha, ms == null ? "0" : ms);
    }

    /** game.gz 받기 → 풀기 → sha256 확인 */
    private byte[] download(Manifest m) throws IOException, InterruptedException {
        byte[] raw = getRetry(m.file, m.base + m.file, gameMs, MAX_GZ);
        byte[] html = gunzip(raw);
        if (!hex(sha256(html)).equals(m.sha256)) throw new Fail("sha256");
        return html;
    }

    /** game-<버전>.html 을 쓴 뒤 version.json 을 바꿔 가리키게 한다 (둘 다 임시 파일 → rename) */
    private Game save(Manifest m, byte[] html) throws IOException {
        if (!gameDir.isDirectory() && !gameDir.mkdirs()) throw new Fail("disk");
        File hf = new File(gameDir, "game-" + m.version + ".html");
        writeAtomic(hf, html);
        JSONObject j = new JSONObject();
        try {
            j.put("version", m.version).put("label", m.label).put("minShell", m.minShell).put("sha256", m.sha256)
                    .put("file", hf.getName()).put("size", html.length).put("from", host(m.base)).put("date", stamp());
        } catch (JSONException e) {
            throw new Fail("json");
        }
        writeAtomic(new File(gameDir, "version.json"), j.toString().getBytes(StandardCharsets.UTF_8));
        return new Game(m.version, m.label, m.minShell, m.sha256, hf);
    }

    /* ───────────────────────── 네트워크 ───────────────────────── */

    /** 한 번 실패하면 잠깐 쉬고 한 번 더 */
    private byte[] getRetry(String what, String url, long ms, int max) throws IOException, InterruptedException {
        try {
            return get(url, ms, max);
        } catch (IOException e) {
            log(host(url) + " " + what + " 1차 실패 (" + reason(e) + ") → " + backoffMs + "ms 뒤 다시");
            Thread.sleep(backoffMs);
            return get(url, ms, max);
        }
    }

    /** ms 안에 끝나지 않으면 연결을 끊는다 (DNS 가 멈춰도 여기서는 ms 뒤에 돌아온다) */
    private byte[] get(String url, long ms, int max) throws IOException, InterruptedException {
        AtomicReference<HttpURLConnection> conn = new AtomicReference<>();
        Future<byte[]> f = net.submit(() -> fetch(url, ms, max, conn));
        try {
            return f.get(ms + 500, TimeUnit.MILLISECONDS);
        } catch (TimeoutException e) {
            f.cancel(true);
            HttpURLConnection c = conn.get();
            if (c != null) c.disconnect();
            throw new SocketTimeoutException("timeout");
        } catch (ExecutionException e) {
            Throwable c = e.getCause();
            if (c instanceof IOException) throw (IOException) c;
            if (c instanceof SecurityException) throw new Fail("permission"); // INTERNET 권한 없음
            throw new Fail("io");
        } catch (InterruptedException e) {
            f.cancel(true);
            HttpURLConnection c = conn.get();
            if (c != null) c.disconnect();
            throw e;
        }
    }

    private static byte[] fetch(String url, long ms, int max, AtomicReference<HttpURLConnection> hold) throws IOException {
        long deadline = System.currentTimeMillis() + ms;
        HttpURLConnection c = (HttpURLConnection) new URL(url + (url.indexOf('?') < 0 ? "?" : "&") + "t=" + System.currentTimeMillis()).openConnection();
        hold.set(c);
        try {
            c.setConnectTimeout((int) ms);
            c.setReadTimeout((int) ms);
            c.setUseCaches(false);
            c.setInstanceFollowRedirects(true);
            c.setRequestProperty("Cache-Control", "no-cache");
            int code = c.getResponseCode();
            if (code != HttpURLConnection.HTTP_OK) throw new Fail("HTTP " + code);
            if (c.getContentLengthLong() > max) throw new Fail("size");
            try (InputStream in = c.getInputStream()) {
                return readAll(in, max, deadline);
            }
        } finally {
            c.disconnect();
        }
    }

    /** 끝까지 읽기 (max 보다 크면 size, deadline 이 지나면 timeout. deadline 0 = 없음) */
    static byte[] readAll(InputStream in, int max, long deadline) throws IOException {
        ByteArrayOutputStream o = new ByteArrayOutputStream();
        byte[] b = new byte[64 * 1024];
        int n;
        while ((n = in.read(b)) != -1) {
            o.write(b, 0, n);
            if (o.size() > max) throw new Fail("size");
            if (deadline > 0 && System.currentTimeMillis() > deadline) throw new SocketTimeoutException("timeout");
        }
        return o.toByteArray();
    }

    /** gzip 이면 풀고, 서버가 이미 풀어서 준 것이면 그대로 (아래 sha256 으로 검증) */
    private static byte[] gunzip(byte[] raw) throws IOException {
        if (raw.length < 2 || (raw[0] & 0xff) != 0x1f || (raw[1] & 0xff) != 0x8b) return raw;
        try (InputStream in = new GZIPInputStream(new ByteArrayInputStream(raw), 64 * 1024)) {
            return readAll(in, MAX_HTML, 0);
        } catch (Fail e) {
            throw e;
        } catch (IOException e) {
            throw new Fail("gzip");
        }
    }

    /** 실패 이유를 짧게: offline · timeout · connect · ssl · HTTP 404 · sha256 · minShell · gzip · size · bad json · disk · io */
    static String reason(Throwable e) {
        if (e instanceof Fail) return e.getMessage();
        if (e instanceof UnknownHostException || e instanceof NoRouteToHostException) return "offline";
        if (e instanceof SocketTimeoutException) return "timeout";
        if (e instanceof ConnectException) {
            String m = String.valueOf(e.getMessage());
            return m.contains("ENETUNREACH") || m.contains("unreachable") ? "offline" : "connect";
        }
        if (e instanceof SSLException) return "ssl";
        if (e instanceof JSONException) return "bad json";
        if (e instanceof SecurityException) return "permission";
        return "io";
    }

    static String host(String url) {
        try {
            return new URL(url).getAuthority();
        } catch (MalformedURLException e) {
            return url;
        }
    }

    private static String join(Iterable<String> xs) {
        StringBuilder sb = new StringBuilder();
        for (String x : xs) sb.append(sb.length() > 0 ? ", " : "").append(x);
        return sb.toString();
    }

    /* ───────────────────────── 상태 → 게임 ───────────────────────── */

    String statusJson() {
        JSONObject s = new JSONObject();
        synchronized (lock) {
            Game g = current;
            try {
                s.put("state", state);
                s.put("current", ver(g != null ? g.version : bundledVersion, g != null ? g.label : bundledLabel));
                s.put("latest", latestVersion == null ? JSONObject.NULL : ver(latestVersion, latestLabel));
                s.put("error", error == null ? JSONObject.NULL : error);
                s.put("at", at);
                s.put("applied", applied);
                s.put("seq", seq);
                s.put("shell", shell);
            } catch (JSONException e) { /* 이름이 null 이 아니면 생기지 않는다 */ }
        }
        return s.toString();
    }

    private static JSONObject ver(String v, String l) throws JSONException {
        return new JSONObject().put("version", v).put("label", l == null ? "" : l);
    }

    /** 상태를 바꾼 그 잠금 안에서 부른다 → 바뀐 순서대로 전해진다 (listener 는 Handler.post 처럼 금방 끝나야 하고 Updater 를 다시 부르면 안 됨) */
    private void notifyStatus(boolean done) {
        synchronized (lock) {
            if (closed || listener == null) return;
            try {
                listener.onStatus(statusJson(), done);
            } catch (RuntimeException e) {
                log("상태 전달 오류: " + e);
            }
        }
    }

    /** Activity 가 사라질 때: 확인을 멈춘다 (저장은 임시 파일 → rename 이라 중간에 멈춰도 안전) */
    void close() {
        synchronized (lock) {
            closed = true;
        }
        worker.shutdownNow();
        net.shutdownNow();
    }

    /* ───────────────────────── 다리 스크립트 끼워 넣기 (android/scripts/prepare-assets.js 의 inject 와 똑같이) ───────────────────────── */

    private static final Pattern CHARSET = Pattern.compile("<meta\\s+charset=[\"']?utf-8[\"']?\\s*/?>", Pattern.CASE_INSENSITIVE);
    private static final Pattern HEAD = Pattern.compile("<head[^>]*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern HEAD_END = Pattern.compile("</head>", Pattern.CASE_INSENSITIVE);
    private static final Pattern VIEWPORT = Pattern.compile("<meta\\s+name=[\"']?viewport[\"']?\\s+content=([\"'])([^\"']*)\\1\\s*/?>", Pattern.CASE_INSENSITIVE);
    private static final Pattern FIT = Pattern.compile("viewport-fit\\s*=");

    /**
     * &lt;meta charset&gt; 바로 뒤(없으면 &lt;head&gt; 바로 뒤)에 &lt;script&gt;다리&lt;/script&gt; · viewport 에 viewport-fit=cover.
     * shim = assets/android-shim.js (자리 __SKW_VERSION__ · __SKW_LABEL__ · __SKW_SHELL__). &lt;head&gt; 가 없으면 null.
     */
    static String inject(String html, String shim, String version, String label, String shell) {
        String tag = "<script>" + shim.replace("__SKW_VERSION__", version).replace("__SKW_LABEL__", label == null ? "" : label)
                .replace("__SKW_SHELL__", shell) + "</script>";
        Matcher h = HEAD.matcher(html);
        if (!h.find()) return null;
        Matcher he = HEAD_END.matcher(html);
        int headEnd = he.find() ? he.start() : -1;
        Matcher c = CHARSET.matcher(html);
        if (c.find() && c.start() < headEnd) html = html.substring(0, c.end()) + tag + html.substring(c.end());
        else html = html.substring(0, h.end()) + "<meta charset=\"utf-8\">" + tag + html.substring(h.end());
        Matcher v = VIEWPORT.matcher(html);
        if (v.find()) {
            if (!FIT.matcher(v.group(2)).find())
                html = html.substring(0, v.start()) + "<meta name=\"viewport\" content=\"" + v.group(2) + ",viewport-fit=cover\">" + html.substring(v.end());
        } else {
            int i = html.indexOf(tag);
            html = html.substring(0, i) + "<meta name=\"viewport\" content=\"width=device-width,initial-scale=1,viewport-fit=cover\">" + html.substring(i);
        }
        return html;
    }

    /* ───────────────────────── 파일 · 기록 ───────────────────────── */

    static byte[] readFile(File f, int max) throws IOException {
        if (f.length() > max) throw new Fail("size");
        try (InputStream in = new FileInputStream(f)) {
            return readAll(in, max, 0);
        }
    }

    /** 같은 폴더의 임시 파일에 다 쓰고(fsync) rename — 중간에 꺼져도 예전 파일이 그대로 남는다 */
    static void writeAtomic(File f, byte[] data) throws IOException {
        File tmp = new File(f.getParentFile(), f.getName() + "." + Long.toHexString(System.nanoTime()) + ".tmp");
        try (FileOutputStream o = new FileOutputStream(tmp)) {
            o.write(data);
            o.getFD().sync();
        } catch (IOException e) {
            if (!tmp.delete()) tmp.deleteOnExit();
            throw new Fail("disk");
        }
        if (!tmp.renameTo(f)) {
            if (!tmp.delete()) tmp.deleteOnExit();
            throw new Fail("disk");
        }
    }

    static byte[] sha256(byte[] b) {
        try {
            return MessageDigest.getInstance("SHA-256").digest(b);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e); // 모든 Java · Android 에 있다
        }
    }

    static String hex(byte[] b) {
        StringBuilder sb = new StringBuilder(b.length * 2);
        for (byte x : b) sb.append(Character.forDigit((x >> 4) & 15, 16)).append(Character.forDigit(x & 15, 16));
        return sb.toString();
    }

    private static String stamp() {
        return new SimpleDateFormat("yyyy-MM-dd HH:mm:ss Z", Locale.ROOT).format(new Date());
    }

    /** filesDir/update.log 에 한 줄 (약 200줄까지만 남긴다) */
    void log(String msg) {
        byte[] line = (stamp() + " " + msg.replace('\n', ' ') + "\n").getBytes(StandardCharsets.UTF_8);
        synchronized (logLock) {
            try (FileOutputStream o = new FileOutputStream(logFile, true)) {
                o.write(line);
            } catch (IOException e) {
                return;
            }
            if (logFile.length() <= LOG_TRIM_BYTES) return;
            try {
                String[] ls = new String(readFile(logFile, 1 << 20), StandardCharsets.UTF_8).split("\n");
                StringBuilder sb = new StringBuilder();
                for (int i = Math.max(0, ls.length - LOG_LINES); i < ls.length; i++) if (!ls[i].isEmpty()) sb.append(ls[i]).append('\n');
                writeAtomic(logFile, sb.toString().getBytes(StandardCharsets.UTF_8));
            } catch (IOException e) {
                if (!logFile.delete()) logFile.deleteOnExit();
            }
        }
    }

    /** 기록 전체 (게임이 보여 줄 수 있게) */
    String logText() {
        synchronized (logLock) {
            try {
                return new String(readFile(logFile, 1 << 20), StandardCharsets.UTF_8);
            } catch (IOException e) {
                return "";
            }
        }
    }
}
