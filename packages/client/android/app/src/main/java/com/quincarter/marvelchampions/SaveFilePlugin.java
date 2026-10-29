package com.quincarter.marvelchampions;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.DocumentsContract;
import androidx.activity.result.ActivityResult;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.FileNotFoundException;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;

/**
 * Saves a text file where the player chooses, through Android's own Save dialog (#534).
 *
 * The WebView has no Web Share API and drops a page's blob downloads (Capacitor sets no download listener), so the
 * save-data Export and the report panel's Download log did nothing in the app. `save` opens the Storage Access
 * Framework's create-document picker in Downloads with the file name filled in, as the desktop app's Save dialog does,
 * and writes the text to the file the player picks. It needs no storage permission. Closing the picker resolves
 * `saved: false`. `src/platform/android-save-file.ts` calls it.
 */
@CapacitorPlugin(name = "SaveFile")
public class SaveFilePlugin extends Plugin {

    /** Downloads on the device's own storage; a picker that doesn't know it opens where it last was. */
    private static final Uri DOWNLOADS = DocumentsContract.buildDocumentUri(
        "com.android.externalstorage.documents",
        "primary:Download"
    );

    /**
     * The text waiting for the picker. It is kept out of the saved call: Capacitor writes a saved call's data into the
     * activity's saved state when the picker covers it, and a save of a few hundred kilobytes there would pass the
     * binder's limit and crash the app. Lost with the process, as the page's promise is.
     */
    private byte[] pending;

    @PluginMethod
    public void save(PluginCall call) {
        String fileName = call.getString("fileName");
        String contents = call.getString("contents");
        if (fileName == null || contents == null) {
            call.reject("A file name and contents are needed");
            return;
        }
        // One Save dialog at a time: a second save would replace the first one's text and strand its promise.
        if (pending != null) {
            call.reject("A Save dialog is already open");
            return;
        }
        pending = contents.getBytes(StandardCharsets.UTF_8);
        call.getData().remove("contents");
        Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT)
            .addCategory(Intent.CATEGORY_OPENABLE)
            .setType(call.getString("mimeType", "application/octet-stream"))
            .putExtra(Intent.EXTRA_TITLE, fileName);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            intent.putExtra(DocumentsContract.EXTRA_INITIAL_URI, DOWNLOADS);
        }
        try {
            startActivityForResult(call, intent, "picked");
        } catch (ActivityNotFoundException e) {
            pending = null;
            call.reject("This device has no Save dialog");
        }
    }

    @ActivityCallback
    private void picked(PluginCall call, ActivityResult result) {
        byte[] bytes = pending;
        pending = null;
        if (call == null) return;
        Intent data = result.getData();
        Uri uri = data == null ? null : data.getData();
        if (result.getResultCode() != Activity.RESULT_OK || uri == null) {
            call.resolve(outcome(false));
            return;
        }
        if (bytes == null) {
            call.reject("The file's contents were lost while the Save dialog was open");
            discard(uri);
            return;
        }
        // A save can run to a few megabytes: written off the UI thread.
        new Thread(() -> {
            try (OutputStream out = open(uri)) {
                if (out == null) throw new IOException("The chosen file could not be opened");
                out.write(bytes);
            } catch (IOException | SecurityException e) {
                discard(uri);
                call.reject("The file could not be saved: " + e.getMessage());
                return;
            }
            call.resolve(outcome(true));
        }).start();
    }

    /** Removes the empty or half-written file the picker made, so Downloads holds no save that won't import. */
    private void discard(Uri uri) {
        try {
            DocumentsContract.deleteDocument(getContext().getContentResolver(), uri);
        } catch (Exception ignored) {
            // A provider that can't delete keeps the file; the error already says the save failed.
        }
    }

    /** "wt" truncates; a provider that doesn't take it (some cloud ones) gets plain "w", fine for a new file. */
    private OutputStream open(Uri uri) throws FileNotFoundException {
        try {
            return getContext().getContentResolver().openOutputStream(uri, "wt");
        } catch (FileNotFoundException | IllegalArgumentException e) {
            return getContext().getContentResolver().openOutputStream(uri, "w");
        }
    }

    private static JSObject outcome(boolean saved) {
        JSObject answer = new JSObject();
        answer.put("saved", saved);
        return answer;
    }
}
