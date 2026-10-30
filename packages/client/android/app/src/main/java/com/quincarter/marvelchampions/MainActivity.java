package com.quincarter.marvelchampions;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins register before the bridge starts.
        registerPlugin(ExternalBrowserPlugin.class);
        registerPlugin(PowerSavingPlugin.class);
        registerPlugin(DisplayRatePlugin.class);
        registerPlugin(DeviceHardwarePlugin.class);
        registerPlugin(BackGesturePlugin.class);
        registerPlugin(SaveFilePlugin.class);
        super.onCreate(savedInstanceState);
        // After the bridge: it replaces the insets listener Capacitor's SystemBars set while loading.
        KeyboardOverlay.install(this);
    }
}
