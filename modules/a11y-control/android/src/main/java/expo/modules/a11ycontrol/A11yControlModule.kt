package expo.modules.a11ycontrol

import android.content.Context
import android.content.Intent
import android.provider.Settings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

class A11yControlModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw CodedException("NO_CONTEXT", "React context unavailable", null)

  private fun service(promise: Promise): AssistantAccessibilityService? {
    val s = AssistantAccessibilityService.instance
    if (s == null) promise.reject("SERVICE_DISABLED", "Accessibility service is not enabled", null)
    return s
  }

  override fun definition() = ModuleDefinition {
    Name("A11yControl")

    Events("onStopRequested")

    OnCreate {
      AgentBridge.onStop = { sendEvent("onStopRequested", mapOf<String, Any>()) }
    }

    OnDestroy {
      AgentBridge.onStop = null
    }

    /**
     * running=true: start the foreground service (notification with Stop) and show the floating Stop button.
     * running=false: tear both down. Call again with new `status` text to update the notification.
     */
    Function("setRunning") { running: Boolean, status: String ->
      val ctx = context
      val svc = Intent(ctx, AgentForegroundService::class.java)
      if (running) {
        svc.putExtra(AgentForegroundService.EXTRA_TEXT, status)
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) ctx.startForegroundService(svc)
        else ctx.startService(svc)
      } else {
        ctx.stopService(svc)
      }
      AssistantAccessibilityService.instance?.showOverlay(running, "■ STOP")
    }

    Function("isServiceEnabled") { AssistantAccessibilityService.instance != null }

    Function("openAccessibilitySettings") {
      val i = Intent(Settings.ACTION_ACCESSIBILITY_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(i)
    }

    /** JSON string: {package,width,height,elements:[...], screenshot?: base64 jpeg, screenshotError?} */
    AsyncFunction("getScreen") { includeScreenshot: Boolean, maxEdge: Int, promise: Promise ->
      val s = service(promise) ?: return@AsyncFunction
      val out = try { s.dumpScreen() } catch (t: Throwable) {
        promise.reject("DUMP_FAILED", t.message, t); return@AsyncFunction
      }
      if (!includeScreenshot) {
        promise.resolve(out.toString())
        return@AsyncFunction
      }
      s.screenshot(maxEdge, 70) { b64, err ->
        if (b64 != null) out.put("screenshot", b64) else out.put("screenshotError", err ?: "unknown")
        promise.resolve(out.toString())
      }
    }

    AsyncFunction("tap") { x: Int, y: Int, durationMs: Int, promise: Promise ->
      val s = service(promise) ?: return@AsyncFunction
      s.tap(x, y, durationMs.toLong()) { ok -> promise.resolve(ok) }
    }

    AsyncFunction("swipe") { x1: Int, y1: Int, x2: Int, y2: Int, durationMs: Int, promise: Promise ->
      val s = service(promise) ?: return@AsyncFunction
      s.swipe(x1, y1, x2, y2, durationMs.toLong()) { ok -> promise.resolve(ok) }
    }

    AsyncFunction("setText") { text: String, append: Boolean, promise: Promise ->
      val s = service(promise) ?: return@AsyncFunction
      promise.resolve(s.setFocusedText(text, append))
    }

    AsyncFunction("globalAction") { name: String, promise: Promise ->
      val s = service(promise) ?: return@AsyncFunction
      promise.resolve(s.globalAction(name))
    }

    /** Launch by package name, or by (case-insensitive substring of) app label. */
    AsyncFunction("launchApp") { query: String, promise: Promise ->
      val pm = context.packageManager
      val main = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      val apps = pm.queryIntentActivities(main, 0)
      val q = query.trim().lowercase()
      val match = apps.firstOrNull { it.activityInfo.packageName.lowercase() == q }
        ?: apps.firstOrNull { it.loadLabel(pm).toString().lowercase() == q }
        ?: apps.firstOrNull { it.loadLabel(pm).toString().lowercase().contains(q) }
      if (match == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      val intent = pm.getLaunchIntentForPackage(match.activityInfo.packageName)
      if (intent == null) {
        promise.resolve(false)
        return@AsyncFunction
      }
      intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
      promise.resolve(true)
    }

    /** JSON string: [{label, package}] of launchable apps. */
    Function("listApps") {
      val pm = context.packageManager
      val main = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
      val arr = JSONArray()
      pm.queryIntentActivities(main, 0).forEach {
        arr.put(JSONObject().put("label", it.loadLabel(pm).toString()).put("package", it.activityInfo.packageName))
      }
      arr.toString()
    }
  }
}
