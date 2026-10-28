package com.quincarter.marvelchampions;

import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * Hands Android's back gesture (the swipe in from either edge) and the back button to the game, instead of letting
 * them close the app (#480).
 *
 * Each back sends a `back` event; the game steps back a screen, closes what is open or opens Pause in a game, as
 * Escape does (`src/platform/back-gesture.ts`). On the Title screen, with nothing open over it, the game calls
 * `minimize`, which sends the app to the background as Android's own back does at an app's first screen. The
 * androidx dispatcher also takes Android 16's predictive back, which no longer calls `onBackPressed`. While the page
 * has no listener (it has not loaded, or it failed to), back does what it always did.
 */
@CapacitorPlugin(name = "BackGesture")
public class BackGesturePlugin extends Plugin {

    private static final String EVENT = "back";

    @Override
    public void load() {
        getActivity().runOnUiThread(() ->
            getActivity()
                .getOnBackPressedDispatcher()
                .addCallback(
                    getActivity(),
                    new OnBackPressedCallback(true) {
                        @Override
                        public void handleOnBackPressed() {
                            if (hasListeners(EVENT)) {
                                notifyListeners(EVENT, new JSObject());
                                return;
                            }
                            setEnabled(false);
                            getActivity().getOnBackPressedDispatcher().onBackPressed();
                            setEnabled(true);
                        }
                    }
                )
        );
    }

    @PluginMethod
    public void minimize(PluginCall call) {
        getActivity().runOnUiThread(() -> getActivity().moveTaskToBack(true));
        call.resolve();
    }
}
