package io.github.mred01.ednote;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.annotation.CapacitorPlugin;

/* Hands a file opened with ED Note (or shared to it) over to the web app.
   MainActivity copies the file into the app's cache and calls announce(); the app listens for the "file" event.
   retainUntilConsumed keeps the event until the app has started listening (cold start from a file). */
@CapacitorPlugin(name = "EdIncoming")
public class EdIncomingPlugin extends Plugin {
    void announce(String path, String name) {
        JSObject r = new JSObject();
        r.put("path", path);
        r.put("name", name);
        notifyListeners("file", r, true);
    }
}
