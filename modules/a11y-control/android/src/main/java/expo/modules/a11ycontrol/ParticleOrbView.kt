package expo.modules.a11ycontrol

import android.animation.ValueAnimator
import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.view.View
import android.view.animation.LinearInterpolator
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

/**
 * Small halftone "particle sphere" used as the control-mode button: concentric rings of dots whose
 * size and brightness sweep around like the orb in the app. Tapping it stops the running task.
 */
class ParticleOrbView(context: Context) : View(context) {

  private val dot = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; style = Paint.Style.FILL }
  private val back = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xCC0B0704.toInt(); style = Paint.Style.FILL }
  private val rim = Paint(Paint.ANTI_ALIAS_FLAG).apply {
    color = 0x99FF6A1A.toInt(); style = Paint.Style.STROKE; strokeWidth = resources.displayMetrics.density * 1.5f
  }

  // (radius as a fraction of the orb, number of dots)
  private val rings = arrayOf(0.30f to 7, 0.52f to 12, 0.74f to 18, 0.94f to 24)
  private var phase = 0f
  private var animator: ValueAnimator? = null

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    animator = ValueAnimator.ofFloat(0f, (2 * PI).toFloat()).apply {
      duration = 3600
      interpolator = LinearInterpolator()
      repeatCount = ValueAnimator.INFINITE
      addUpdateListener { phase = it.animatedValue as Float; invalidate() }
      start()
    }
  }

  override fun onDetachedFromWindow() {
    animator?.cancel()
    animator = null
    super.onDetachedFromWindow()
  }

  override fun onDraw(canvas: Canvas) {
    val cx = width / 2f
    val cy = height / 2f
    val r = minOf(cx, cy) - rim.strokeWidth
    canvas.drawCircle(cx, cy, r, back)
    canvas.drawCircle(cx, cy, r, rim)

    val breathe = 1f + 0.05f * sin(2 * phase)
    val maxDot = r * 0.105f
    for ((ri, ring) in rings.withIndex()) {
      val (frac, count) = ring
      val rad = r * 0.86f * frac * breathe
      // Alternate rings sweep in opposite directions so the sphere looks like it is turning.
      val dir = if (ri % 2 == 0) 1f else -1f
      for (i in 0 until count) {
        val a = (2 * PI * i / count).toFloat()
        val b = 0.5f + 0.5f * cos(a - dir * phase)
        dot.alpha = (70 + 185 * b).toInt()
        canvas.drawCircle(cx + rad * cos(a), cy + rad * sin(a), maxDot * (0.3f + 0.7f * b), dot)
      }
    }
  }
}
