package com.quincarter.marvelchampions;

import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.net.Uri;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.List;

/**
 * Opens a link in the player's web browser, never in an app that claims the link's site.
 *
 * Capacitor sends a navigation off the app's origin out as a plain ACTION_VIEW intent. For a github.com link that
 * intent goes to the GitHub app when it is installed (it verifies github.com as an App Link), and the GitHub app shows
 * a release download in its in-app Custom Tab, where a large APK stalls and the finished file's Open does nothing. So
 * this asks which app handles an ordinary https link (a site no app claims) and sends the intent to that browser.
 * `src/platform/platform.ts` calls it; the manifest's `<queries>` lets it see the browsers on Android 11+.
 */
@CapacitorPlugin(name = "ExternalBrowser")
public class ExternalBrowserPlugin extends Plugin {

    private static final Uri BROWSER_PROBE = Uri.parse("https://example.com/");

    @PluginMethod
    public void open(PluginCall call) {
        String url = call.getString("url");
        Uri uri = url == null ? null : Uri.parse(url);
        if (uri == null || !"https".equals(uri.getScheme())) {
            call.reject("Only https links open in the browser");
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, uri)
            .addCategory(Intent.CATEGORY_BROWSABLE)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        String browser = browserPackage();
        if (browser != null) intent.setPackage(browser);
        try {
            getContext().startActivity(intent);
        } catch (ActivityNotFoundException e) {
            // The browser went away between asking and opening: let the system pick, as Capacitor would have.
            try {
                getContext().startActivity(intent.setPackage(null));
            } catch (ActivityNotFoundException none) {
                call.reject("No app can open " + url);
                return;
            }
        }
        call.resolve();
    }

    /** The default browser, or the first browser installed when none is the default; null when there is none. */
    private String browserPackage() {
        PackageManager packages = getContext().getPackageManager();
        Intent probe = new Intent(Intent.ACTION_VIEW, BROWSER_PROBE).addCategory(Intent.CATEGORY_BROWSABLE);
        ResolveInfo preferred = packages.resolveActivity(probe, PackageManager.MATCH_DEFAULT_ONLY);
        // With no default set, the system's own chooser ("android") answers instead of a browser.
        if (preferred != null && preferred.activityInfo != null && !"android".equals(preferred.activityInfo.packageName)) {
            return preferred.activityInfo.packageName;
        }
        List<ResolveInfo> browsers = packages.queryIntentActivities(probe, PackageManager.MATCH_DEFAULT_ONLY);
        return browsers.isEmpty() ? null : browsers.get(0).activityInfo.packageName;
    }
}
