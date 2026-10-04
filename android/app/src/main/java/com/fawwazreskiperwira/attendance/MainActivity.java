package com.fawwazreskiperwira.attendance;

import android.os.Bundle;
import android.util.Log;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private static final String TAG = "HRMAttendance";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Anti-crash guard: Tangkap uncaught exceptions agar aplikasi tidak crash/force-close
        Thread.setDefaultUncaughtExceptionHandler((thread, throwable) -> {
            Log.e(TAG, "Uncaught exception safely trapped: " + throwable.getMessage(), throwable);
        });

        try {
            WebView webView = getBridge().getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setJavaScriptEnabled(true);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                // Memastikan WebView selalu menyinkronkan aset terbaru dari server produksi secara live
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                settings.setGeolocationEnabled(true);
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setAllowFileAccess(true);
                settings.setAllowContentAccess(true);
                settings.setUseWideViewPort(true);
                settings.setLoadWithOverviewMode(true);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error configuring webview: " + e.getMessage());
        }
    }
}
