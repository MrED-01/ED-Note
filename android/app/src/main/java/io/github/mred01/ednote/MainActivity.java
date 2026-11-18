package io.github.mred01.ednote;

import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.provider.OpenableColumns;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.PluginHandle;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;

/* Microsoft sign-in (licence and OneDrive) ends with a redirect from login.live.com back to https://localhost/?code=...
   Android's WebView does not hand such a cross-site redirect to Capacitor's local server, so the page fails with
   ERR_CONNECTION_REFUSED. Here the redirect is stopped and the same address is opened as a fresh app navigation,
   which Capacitor serves from the app files. */
public class MainActivity extends BridgeActivity {
    private String lastRetry = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(EdIncomingPlugin.class);
        super.onCreate(savedInstanceState);
        if (bridge == null) return;
        handleIncoming(getIntent());
        final String host = bridge.getHost();
        bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
            private boolean isAppReturn(Uri u) {
                return u != null && host != null && host.equalsIgnoreCase(u.getHost()) && u.getQuery() != null
                    && (u.getQueryParameter("code") != null || u.getQueryParameter("error") != null);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                final Uri u = request.getUrl();
                if (request.isForMainFrame() && isAppReturn(u)) {
                    view.post(() -> view.loadUrl(u.toString()));
                    return true;
                }
                return super.shouldOverrideUrlLoading(view, request);
            }

            @Override
            public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                final Uri u = request.getUrl();
                if (request.isForMainFrame() && isAppReturn(u) && !u.toString().equals(lastRetry)) {
                    lastRetry = u.toString();
                    view.post(() -> view.loadUrl(u.toString()));
                    return;
                }
                super.onReceivedError(view, request, error);
            }
        });
    }

    /* ---------- "open with ED Note" (VIEW) and "share to ED Note" (SEND) ---------- */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        handleIncoming(intent);
    }

    private void handleIncoming(Intent intent) {
        if (intent == null || bridge == null) return;
        Uri uri = null;
        if (Intent.ACTION_VIEW.equals(intent.getAction())) uri = intent.getData();
        else if (Intent.ACTION_SEND.equals(intent.getAction())) {
            if (Build.VERSION.SDK_INT >= 33) uri = intent.getParcelableExtra(Intent.EXTRA_STREAM, Uri.class);
            else uri = intent.getParcelableExtra(Intent.EXTRA_STREAM);
        }
        if (uri == null) return;
        setIntent(new Intent(this, MainActivity.class)); /* not handled twice after a screen rotation */
        final Uri src = uri;
        new Thread(() -> {
            try {
                String name = displayName(src);
                File dir = new File(getCacheDir(), "incoming");
                dir.mkdirs();
                File[] old = dir.listFiles();
                if (old != null) for (File f : old) f.delete();
                File out = new File(dir, name.replaceAll("[\\\\/:*?\"<>|]+", "_"));
                try (InputStream in = getContentResolver().openInputStream(src); OutputStream o = new FileOutputStream(out)) {
                    if (in == null) return;
                    byte[] buf = new byte[1 << 16];
                    int n;
                    while ((n = in.read(buf)) > 0) o.write(buf, 0, n);
                }
                final String path = "file://" + out.getAbsolutePath(), shown = name;
                runOnUiThread(() -> {
                    PluginHandle h = bridge.getPlugin("EdIncoming");
                    if (h != null && h.getInstance() instanceof EdIncomingPlugin) ((EdIncomingPlugin) h.getInstance()).announce(path, shown);
                });
            } catch (Exception e) {
                e.printStackTrace();
            }
        }).start();
    }

    private String displayName(Uri uri) {
        String name = null;
        if ("content".equals(uri.getScheme())) {
            try (Cursor c = getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null)) {
                if (c != null && c.moveToFirst()) name = c.getString(0);
            } catch (Exception ignored) {}
        }
        if (name == null) name = uri.getLastPathSegment();
        if (name == null || name.isEmpty()) name = "dosya.ednote";
        return name;
    }
}
