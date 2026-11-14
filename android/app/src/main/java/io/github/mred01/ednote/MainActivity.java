package io.github.mred01.ednote;

import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

/* Microsoft sign-in (licence and OneDrive) ends with a redirect from login.live.com back to https://localhost/?code=...
   Android's WebView does not hand such a cross-site redirect to Capacitor's local server, so the page fails with
   ERR_CONNECTION_REFUSED. Here the redirect is stopped and the same address is opened as a fresh app navigation,
   which Capacitor serves from the app files. */
public class MainActivity extends BridgeActivity {
    private String lastRetry = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        if (bridge == null) return;
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
}
