package com.quincarter.marvelchampions;

import android.app.ActivityManager;
import android.content.Context;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * What the phone is, for the game's recommended screen settings (`src/platform/device-tier.ts`).
 *
 * The page can only guess: `navigator.deviceMemory` stops at 8 and rounds down to a bucket, and nothing in a WebView
 * says how fast the phone is. The OS knows the real memory, whether it counts as a low-RAM device, the chip, and its
 * media performance class (Android 12+), which is Android's own rating of a phone's tier.
 */
@CapacitorPlugin(name = "DeviceHardware")
public class DeviceHardwarePlugin extends Plugin {

    @PluginMethod
    public void getHardware(PluginCall call) {
        JSObject result = new JSObject();
        ActivityManager activities = (ActivityManager) getContext().getSystemService(Context.ACTIVITY_SERVICE);
        if (activities != null) {
            ActivityManager.MemoryInfo memory = new ActivityManager.MemoryInfo();
            activities.getMemoryInfo(memory);
            result.put("ramMb", memory.totalMem / (1024 * 1024));
            result.put("lowRam", activities.isLowRamDevice());
        }
        result.put("cores", Runtime.getRuntime().availableProcessors());
        result.put("model", Build.MANUFACTURER + " " + Build.MODEL);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            result.put("performanceClass", Build.VERSION.MEDIA_PERFORMANCE_CLASS);
            result.put("soc", Build.SOC_MANUFACTURER + " " + Build.SOC_MODEL);
        }
        call.resolve(result);
    }
}
