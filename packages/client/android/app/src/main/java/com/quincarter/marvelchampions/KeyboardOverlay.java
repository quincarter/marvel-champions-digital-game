package com.quincarter.marvelchampions;

import android.app.Activity;
import android.content.pm.PackageInfo;
import android.os.Build;
import android.view.View;
import android.webkit.WebView;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowInsetsCompat;

/**
 * Lays the on-screen keyboard over the game instead of shrinking it (#537).
 *
 * Capacitor's SystemBars plugin pads the window's root by the keyboard's height whenever the keyboard shows, so the
 * WebView, and the canvas in it, shrank to the space above the keyboard and the game re-laid out for a few letters of
 * typing. `adjustNothing` in the manifest doesn't stop that: Android still reports the keyboard's insets. This
 * replaces that plugin's insets listener with the same handling minus the keyboard: the system bars are dealt with as
 * Capacitor does, and the keyboard's insets are dropped before the WebView sees them, so its visible area doesn't
 * shrink either. `MainActivity` installs it once the bridge (and SystemBars with it) has loaded.
 */
final class KeyboardOverlay {

    /** WebViews from this version on report safe-area insets to `env()` themselves (chromium 40699457). */
    private static final int WEBVIEW_WITH_SAFE_AREA = 140;

    private KeyboardOverlay() {}

    static void install(Activity activity) {
        View root = activity.getWindow().getDecorView();
        boolean webViewReadsInsets = webViewMajorVersion() >= WEBVIEW_WITH_SAFE_AREA;
        ViewCompat.setOnApplyWindowInsetsListener(root, (view, insets) -> {
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
