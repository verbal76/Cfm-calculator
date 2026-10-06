package com.hotatticgames.cfmcalculator;

import android.content.pm.ApplicationInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.util.Locale;

/** Reports installed-app identity read from the OS at runtime (never hardcoded). */
@CapacitorPlugin(name = "BuildInfo")
public class BuildInfoPlugin extends Plugin {
    @PluginMethod
    public void get(PluginCall call) {
        try {
            String pkg = getContext().getPackageName();
            PackageManager pm = getContext().getPackageManager();
            PackageInfo pi = pm.getPackageInfo(pkg, 0);
            ApplicationInfo ai = getContext().getApplicationInfo();
            JSObject o = new JSObject();
            o.put("packageName", pkg);
            o.put("versionName", pi.versionName);
            o.put("versionCode", Build.VERSION.SDK_INT >= 28 ? pi.getLongVersionCode() : pi.versionCode);
            o.put("targetSdk", ai.targetSdkVersion);
            o.put("minSdk", Build.VERSION.SDK_INT >= 24 ? ai.minSdkVersion : 0);
            o.put("androidRelease", Build.VERSION.RELEASE);
            o.put("androidApi", Build.VERSION.SDK_INT);
            o.put("manufacturer", Build.MANUFACTURER);
            o.put("model", Build.MODEL);
            o.put("locale", Locale.getDefault().toLanguageTag());
            o.put("buildType", (ai.flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0 ? "debuggable" : "release");
            call.resolve(o);
        } catch (Exception e) {
            call.reject("BuildInfo unavailable: " + e.getMessage());
        }
    }
}
