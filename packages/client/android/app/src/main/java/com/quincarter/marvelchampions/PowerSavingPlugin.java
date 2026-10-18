package com.quincarter.marvelchampions;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.PowerManager;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Tells the game whether the device's power saving mode (Android's Battery Saver, or a maker's own, such as Samsung's
 * Power saving, which sets the same system flag) is on, and when it changes.
 *
 * A browser has no way to read this, so only the app can. The OS's own broadcast does the listening: nothing polls,
 * and the game hears a `powerSaveModeChange` event only when the mode actually flips, plus once on every return to
 * the app, in case it flipped while the app was away. `src/platform/power-saving.ts` calls it.
 */
@CapacitorPlugin(name = "PowerSaving")
public class PowerSavingPlugin extends Plugin {

    private static final String EVENT = "powerSaveModeChange";

    private BroadcastReceiver receiver;

    @Override
    public void load() {
        receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                notifyListeners(EVENT, state());
            }
        };
        // A system broadcast reaches a receiver that is not exported; Android 14 asks every receiver to say which it is.
        ContextCompat.registerReceiver(
            getContext(),
            receiver,
            new IntentFilter(PowerManager.ACTION_POWER_SAVE_MODE_CHANGED),
            ContextCompat.RECEIVER_NOT_EXPORTED
        );
    }

    @PluginMethod
    public void isPowerSaveMode(PluginCall call) {
        call.resolve(state());
    }

    @Override
    protected void handleOnResume() {
        super.handleOnResume();
        notifyListeners(EVENT, state());
    }

    @Override
    protected void handleOnDestroy() {
        if (receiver != null) {
            try {
                getContext().unregisterReceiver(receiver);
            } catch (IllegalArgumentException alreadyGone) {
                // Never registered, or already unregistered: nothing to undo.
            }
            receiver = null;
        }
        super.handleOnDestroy();
    }

    private JSObject state() {
        PowerManager power = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
        JSObject result = new JSObject();
        result.put("powerSaveMode", power != null && power.isPowerSaveMode());
        return result;
    }
}
