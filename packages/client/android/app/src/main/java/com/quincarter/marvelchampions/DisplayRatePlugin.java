package com.quincarter.marvelchampions;

import android.app.Activity;
import android.view.Display;
import android.view.Window;
import android.view.WindowManager;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The screen's refresh rate, and which one the game asks the OS for (Settings > Display > Frame rate).
 *
 * Android picks a refresh rate per window, and a WebView's page draws at whatever the window runs at: a 120 Hz phone
 * may still run the app at 60 Hz unless the app asks. "Match screen" asks for the fastest mode at the screen's current
 * resolution; a 60 or 30 fps cap asks for the slowest mode that still covers it, so the panel itself slows down and
 * saves power too. The OS may still pick another rate (battery saver, heat, a maker's own rules): this is a request.
 * `src/platform/screen-settings.ts` calls it.
 */
@CapacitorPlugin(name = "DisplayRate")
public class DisplayRatePlugin extends Plugin {

    @PluginMethod
    public void getInfo(PluginCall call) {
        Activity activity = getActivity();
        Display display = activity == null ? null : activity.getWindowManager().getDefaultDisplay();
        JSObject result = new JSObject();
        if (display == null) {
            result.put("refreshRate", 60);
            result.put("maxRefreshRate", 60);
            call.resolve(result);
            return;
        }
        Display.Mode current = display.getMode();
        float max = current.getRefreshRate();
        for (Display.Mode mode : display.getSupportedModes()) {
            if (sameSize(mode, current)) max = Math.max(max, mode.getRefreshRate());
        }
        result.put("refreshRate", Math.round(display.getRefreshRate()));
        result.put("maxRefreshRate", Math.round(max));
        call.resolve(result);
    }

    /** `fps`: 0 for the fastest mode, otherwise the slowest mode at or above it. */
    @PluginMethod
    public void setFrameRate(PluginCall call) {
        final int fps = call.getInt("fps", 0);
        final Activity activity = getActivity();
        if (activity == null) {
            call.resolve();
            return;
        }
        activity.runOnUiThread(() -> {
            Display display = activity.getWindowManager().getDefaultDisplay();
            Display.Mode current = display.getMode();
            Display.Mode fastest = null;
            Display.Mode slowestCovering = null;
            for (Display.Mode mode : display.getSupportedModes()) {
                if (!sameSize(mode, current)) continue;
                if (fastest == null || mode.getRefreshRate() > fastest.getRefreshRate()) fastest = mode;
                if (fps > 0 && covers(mode, fps)) {
                    if (slowestCovering == null || mode.getRefreshRate() < slowestCovering.getRefreshRate()) {
                        slowestCovering = mode;
                    }
                }
            }
            Display.Mode chosen = slowestCovering != null ? slowestCovering : fastest;
            Window window = activity.getWindow();
            WindowManager.LayoutParams params = window.getAttributes();
            params.preferredDisplayModeId = chosen == null ? 0 : chosen.getModeId();
            window.setAttributes(params);
            call.resolve();
        });
    }

    private static boolean sameSize(Display.Mode a, Display.Mode b) {
        return a.getPhysicalWidth() == b.getPhysicalWidth() && a.getPhysicalHeight() == b.getPhysicalHeight();
    }

    private static boolean covers(Display.Mode mode, int fps) {
        // 59.94 Hz panels count as 60.
        return mode.getRefreshRate() + 0.5f >= fps;
    }
}
