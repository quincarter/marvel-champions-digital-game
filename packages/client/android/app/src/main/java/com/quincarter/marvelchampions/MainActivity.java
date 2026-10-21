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
        super.onCreate(savedInstanceState);
    }
}
