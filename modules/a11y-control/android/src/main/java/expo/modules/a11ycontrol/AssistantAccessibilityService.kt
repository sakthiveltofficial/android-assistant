package expo.modules.a11ycontrol

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Bitmap
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.Rect
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.Display
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.animation.ObjectAnimator
import android.animation.ValueAnimator
import android.graphics.drawable.GradientDrawable
import android.view.accessibility.AccessibilityEvent
import android.view.accessibility.AccessibilityNodeInfo
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.util.concurrent.Executors

/**
 * On-device replacement for what Artemis does over ADB:
 *  - UI tree      -> AccessibilityNodeInfo walk
 *  - tap / swipe  -> dispatchGesture
 *  - screenshot   -> takeScreenshot (API 30+)
 *  - back / home  -> performGlobalAction
 */
class AssistantAccessibilityService : AccessibilityService() {

  companion object {
    @Volatile
    var instance: AssistantAccessibilityService? = null
  }

  private val executor = Executors.newSingleThreadExecutor()

  override fun onServiceConnected() {
    super.onServiceConnected()
    instance = this
  }

  // ---------------------------------------------------------------- Stop overlay
  // TYPE_ACCESSIBILITY_OVERLAY needs no extra permission. It is hidden while we
  // screenshot or inject a gesture so neither the model nor a tap can hit it.

  private val main = Handler(Looper.getMainLooper())
  private var glow: View? = null
  private var stopIcon: View? = null
  private var pulse: ObjectAnimator? = null

  private fun dp(v: Int) = (v * resources.displayMetrics.density).toInt()

  /**
   * "Minimized mode": a soft orange gradient along the bottom edge (touch-transparent, so it never
   * blocks the gestures the agent injects) plus one small tappable icon that stops the task.
   * Both are hidden while we screenshot or inject a gesture.
   */
  fun showOverlay(show: Boolean, label: String) {
    main.post {
      val wm = getSystemService(WINDOW_SERVICE) as WindowManager
      if (!show) {
        pulse?.cancel(); pulse = null
        glow?.let { runCatching { wm.removeView(it) } }
        stopIcon?.let { runCatching { wm.removeView(it) } }
        glow = null; stopIcon = null
        return@post
      }
      if (glow != null) return@post

      val noTouch = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
        WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
        WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
        WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS

      // Gradient strip, brightest at the very bottom, fading upward to transparent.
      val g = View(this).apply {
        background = GradientDrawable(
          GradientDrawable.Orientation.BOTTOM_TOP,
          intArrayOf(0xE6A63B00.toInt(), 0x80802F00.toInt(), 0x00000000),
        )
      }
      val glowLp = WindowManager.LayoutParams(
        WindowManager.LayoutParams.MATCH_PARENT, dp(190),
        WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY, noTouch, PixelFormat.TRANSLUCENT,
      ).apply { gravity = Gravity.BOTTOM }
      wm.addView(g, glowLp)
      glow = g
      pulse = ObjectAnimator.ofFloat(g, View.ALPHA, 0.65f, 1f).apply {
        duration = 1400; repeatMode = ValueAnimator.REVERSE; repeatCount = ValueAnimator.INFINITE; start()
      }

      // Icon only: a small animated particle sphere. This is the only touchable piece; tapping it stops the task.
      val icon = ParticleOrbView(this).apply {
        contentDescription = label
        setOnClickListener { AgentBridge.onStop?.invoke() }
      }
      val iconLp = WindowManager.LayoutParams(
        dp(58), dp(58), WindowManager.LayoutParams.TYPE_ACCESSIBILITY_OVERLAY,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS,
        PixelFormat.TRANSLUCENT,
      ).apply { gravity = Gravity.BOTTOM or Gravity.END; x = dp(18); y = dp(28) }
      wm.addView(icon, iconLp)
      stopIcon = icon
    }
  }

  private fun setOverlayVisible(visible: Boolean) {
    main.post {
      val v = if (visible) View.VISIBLE else View.INVISIBLE
      glow?.visibility = v
      stopIcon?.visibility = v
    }
  }

  override fun onUnbind(intent: android.content.Intent?): Boolean {
    showOverlay(false, "")
    instance = null
    return super.onUnbind(intent)
  }

  override fun onDestroy() {
    instance = null
    super.onDestroy()
  }

  override fun onAccessibilityEvent(event: AccessibilityEvent?) {}
  override fun onInterrupt() {}

  // ---------------------------------------------------------------- UI tree

  /** Returns {package, width, height, elements:[...]} as JSON. Element index == array position. */
  fun dumpScreen(): JSONObject {
    val out = JSONObject()
    val elements = JSONArray()
    val root = rootInActiveWindow
    val metrics = resources.displayMetrics
    out.put("width", metrics.widthPixels)
    out.put("height", metrics.heightPixels)
    out.put("package", root?.packageName?.toString() ?: "")
    if (root != null) {
      walk(root, elements, 0)
      root.recycle()
    }
    out.put("elements", elements)
    return out
  }

  private fun walk(node: AccessibilityNodeInfo, out: JSONArray, depth: Int) {
    if (depth > 60 || out.length() > 400) return
    if (node.isVisibleToUser && isInteresting(node)) {
      val r = Rect()
      node.getBoundsInScreen(r)
      if (r.width() > 0 && r.height() > 0) {
        val o = JSONObject()
        o.put("index", out.length())
        o.put("text", node.text?.toString() ?: "")
        o.put("desc", node.contentDescription?.toString() ?: "")
        o.put("id", node.viewIdResourceName ?: "")
        o.put("class", node.className?.toString() ?: "")
        o.put("clickable", node.isClickable)
        o.put("longClickable", node.isLongClickable)
        o.put("editable", node.isEditable)
        o.put("scrollable", node.isScrollable)
        o.put("checked", node.isChecked)
        o.put("enabled", node.isEnabled)
        o.put("focused", node.isFocused)
        o.put("bounds", JSONArray(listOf(r.left, r.top, r.right, r.bottom)))
        o.put("center", JSONArray(listOf(r.centerX(), r.centerY())))
        out.put(o)
      }
    }
    for (i in 0 until node.childCount) {
      val child = node.getChild(i) ?: continue
      walk(child, out, depth + 1)
      child.recycle()
    }
  }

  private fun isInteresting(n: AccessibilityNodeInfo): Boolean =
    n.isClickable || n.isLongClickable || n.isEditable || n.isScrollable || n.isCheckable ||
      !n.text.isNullOrEmpty() || !n.contentDescription.isNullOrEmpty()

  // ---------------------------------------------------------------- Gestures

  fun tap(x: Int, y: Int, durationMs: Long, cb: (Boolean) -> Unit) {
    val path = Path().apply { moveTo(x.toFloat(), y.toFloat()) }
    dispatch(path, durationMs.coerceAtLeast(1), cb)
  }

  fun swipe(x1: Int, y1: Int, x2: Int, y2: Int, durationMs: Long, cb: (Boolean) -> Unit) {
    val path = Path().apply {
      moveTo(x1.toFloat(), y1.toFloat())
      lineTo(x2.toFloat(), y2.toFloat())
    }
    dispatch(path, durationMs.coerceAtLeast(1), cb)
  }

  private fun dispatch(path: Path, durationMs: Long, cb: (Boolean) -> Unit) {
    val stroke = GestureDescription.StrokeDescription(path, 0, durationMs)
    val gesture = GestureDescription.Builder().addStroke(stroke).build()
    setOverlayVisible(false)
    val started = dispatchGesture(gesture, object : GestureResultCallback() {
      override fun onCompleted(g: GestureDescription?) { setOverlayVisible(true); cb(true) }
      override fun onCancelled(g: GestureDescription?) { setOverlayVisible(true); cb(false) }
    }, null)
    if (!started) { setOverlayVisible(true); cb(false) }
  }

  // ---------------------------------------------------------------- Text / global actions

  /** Sets text on the currently input-focused node. Returns false if nothing is focused. */
  fun setFocusedText(text: String, append: Boolean): Boolean {
    val node = findFocus(AccessibilityNodeInfo.FOCUS_INPUT) ?: return false
    val existing = if (append) (node.text?.toString() ?: "") else ""
    val args = Bundle().apply {
      putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, existing + text)
    }
    val ok = node.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args)
    node.recycle()
    return ok
  }

  fun globalAction(name: String): Boolean {
    val id = when (name.lowercase()) {
      "back" -> GLOBAL_ACTION_BACK
      "home" -> GLOBAL_ACTION_HOME
      "recents" -> GLOBAL_ACTION_RECENTS
      "notifications" -> GLOBAL_ACTION_NOTIFICATIONS
      "quick_settings" -> GLOBAL_ACTION_QUICK_SETTINGS
      "lock_screen" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) GLOBAL_ACTION_LOCK_SCREEN else return false
      else -> return false
    }
    return performGlobalAction(id)
  }

  // ---------------------------------------------------------------- Screenshot

  /** JPEG base64 (no data: prefix), downscaled so the long edge is <= maxEdge. Null on failure. */
  fun screenshot(maxEdge: Int, quality: Int, cb: (String?, String?) -> Unit) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) {
      cb(null, "takeScreenshot requires Android 11+")
      return
    }
    // Hide our stop button for the capture, give the compositor a moment, then restore.
    setOverlayVisible(false)
    main.postDelayed({
      captureNow(maxEdge, quality) { b64, err ->
        setOverlayVisible(true)
        cb(b64, err)
      }
    }, 100)
  }

  private fun captureNow(maxEdge: Int, quality: Int, cb: (String?, String?) -> Unit) {
    takeScreenshot(Display.DEFAULT_DISPLAY, executor, object : TakeScreenshotCallback {
      override fun onSuccess(result: ScreenshotResult) {
        try {
          val hw = Bitmap.wrapHardwareBuffer(result.hardwareBuffer, result.colorSpace)
          if (hw == null) {
            cb(null, "wrapHardwareBuffer returned null")
            return
          }
          val soft = hw.copy(Bitmap.Config.ARGB_8888, false)
          hw.recycle()
          result.hardwareBuffer.close()
          val scale = maxEdge.toFloat() / maxOf(soft.width, soft.height)
          val bmp = if (scale < 1f) {
            Bitmap.createScaledBitmap(soft, (soft.width * scale).toInt(), (soft.height * scale).toInt(), true)
          } else soft
          val bos = ByteArrayOutputStream()
          bmp.compress(Bitmap.CompressFormat.JPEG, quality, bos)
          cb(Base64.encodeToString(bos.toByteArray(), Base64.NO_WRAP), null)
        } catch (t: Throwable) {
          cb(null, t.message ?: "screenshot failed")
        }
      }

      override fun onFailure(errorCode: Int) {
        // errorCode 3 = rate limited (~1 per 333 ms); FLAG_SECURE windows show up as black frames instead.
        cb(null, "takeScreenshot failed, code $errorCode")
      }
    })
  }
}
