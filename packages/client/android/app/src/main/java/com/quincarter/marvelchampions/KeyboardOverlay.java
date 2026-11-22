package com.quincarter.marvelchampions;

import android.app.Activity;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.util.DisplayMetrics;
import android.view.View;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;
import com.getcapacitor.BridgeActivity;

/**
 * Lays the on-screen keyboard over the game instead of shrinking it (#537).
 *
 * Capacitor's SystemBars plugin pads the window's root by the keyboard's height whenever the keyboard shows, so the
 * WebView, and the canvas in it, shrank to the space above the keyboard and the game re-laid out for a few letters of
 * typing. `adjustNothing` in the manifest doesn't stop that: Android still reports the keyboard's insets. This
 * replaces that plugin's insets listener with the same handling minus the keyboard: the system bars are dealt with as
 * Capacitor does, and the keyboard's insets are dropped before the WebView sees them, so its visible area doesn't
 * shrink either. The keyboard's height still goes to the page (`window.__mcKeyboard(cssPx)`,
 * `src/platform/native-keyboard.ts`), because the visual viewport no longer shows it and the room chat must lift its
 * input above it. `MainActivity` installs it once the bridge (and SystemBars with it) has loaded.
 */
final class KeyboardOverlay {

    /** WebViews from this version on report safe-area insets to `env()` themselves (chromium 40699457). */
    private static final int WEBVIEW_WITH_SAFE_AREA = 140;

    private KeyboardOverlay() {}

    private static int lastReported = -1;

    static void install(BridgeActivity activity) {
        View root = activity.getWindow().getDecorView();
        boolean webViewReadsInsets = webViewMajorVersion() >= WEBVIEW_WITH_SAFE_AREA;
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
            report(activity, insets);
            WindowInsetsCompat.Builder withoutKeyboard = new WindowInsetsCompat.Builder(insets)
                .setInsets(WindowInsetsCompat.Type.ime(), Insets.NONE)
                .setVisible(WindowInsetsCompat.Type.ime(), false);
            if (webViewReadsInsets) {
                // The page draws edge to edge (`viewport-fit=cover`, which a native shell always sets) and keeps
                // clear of the bars through `env(safe-area-inset-*)`: nothing to pad.
                view.setPadding(0, 0, 0, 0);
                return withoutKeyboard.build();
            }
            // An older WebView reports no safe area, so the bars are padded around it, as Capacitor does.
            int bars = WindowInsetsCompat.Type.systemBars() | WindowInsetsCompat.Type.displayCutout();
            Insets barInsets = insets.getInsets(bars);
            view.setPadding(barInsets.left, barInsets.top, barInsets.right, barInsets.bottom);
            return withoutKeyboard.setInsets(bars, Insets.NONE).build();
        });
        root.requestApplyInsets();
    }

    /** Tells the page how tall the keyboard is, in CSS px (0 when hidden), when it changed. */
    private static void report(BridgeActivity activity, WindowInsetsCompat insets) {
        boolean shown = insets.isVisible(WindowInsetsCompat.Type.ime());
        int px = shown ? insets.getInsets(WindowInsetsCompat.Type.ime()).bottom : 0;
        if (px == lastReported || activity.getBridge() == null) return;
        WebView web = activity.getBridge().getWebView();
        if (web == null) return;
        lastReported = px;
        DisplayMetrics metrics = activity.getResources().getDisplayMetrics();
        float css = px / metrics.density;
        web.post(() -> web.evaluateJavascript("window.__mcKeyboard&&window.__mcKeyboard(" + css + ")", null));
    }

    /** 0 before Android 8, which can't say: those WebViews are far older than 140 anyway. */
    private static int webViewMajorVersion() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return 0;
        PackageInfo info = WebView.getCurrentWebViewPackage();
        if (info == null || info.versionName == null) return 0;
        try {
            return Integer.parseInt(info.versionName.split("[.]")[0]);
        } catch (NumberFormatException e) {
            return 0;
        }
    }
}
