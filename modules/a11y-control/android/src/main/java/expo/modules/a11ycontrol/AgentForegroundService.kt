package expo.modules.a11ycontrol

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Intent
import android.content.pm.ServiceInfo
import android.graphics.drawable.Icon
import android.os.Build
import android.os.IBinder

/** Bridge between native stop triggers (notification action, overlay button) and the JS agent. */
object AgentBridge {
  @Volatile
  var onStop: (() -> Unit)? = null
}

/**
 * Keeps the app process alive (and visibly so) while an agent task runs.
 * The notification carries a Stop action.
 */
class AgentForegroundService : Service() {

  companion object {
    const val ACTION_STOP = "expo.modules.a11ycontrol.STOP"
    const val EXTRA_TEXT = "text"
    private const val CHANNEL = "assistant_agent"
    private const val NOTIF_ID = 4711
  }

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      AgentBridge.onStop?.invoke()
      return START_NOT_STICKY
    }
    val text = intent?.getStringExtra(EXTRA_TEXT) ?: "Running a task"
    ensureChannel()

    val stopIntent = PendingIntent.getService(
      this, 1,
      Intent(this, AgentForegroundService::class.java).setAction(ACTION_STOP),
      PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )
    val stopAction = Notification.Action.Builder(
      Icon.createWithResource(this, android.R.drawable.ic_delete), "Stop", stopIntent,
    ).build()

    val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) Notification.Builder(this, CHANNEL)
    else @Suppress("DEPRECATION") Notification.Builder(this)
    val notification = builder
      .setContentTitle("Android Assistant is controlling your phone")
      .setContentText(text)
      .setSmallIcon(android.R.drawable.ic_dialog_info)
      .setOngoing(true)
      .addAction(stopAction)
      .build()

    if (Build.VERSION.SDK_INT >= 34) {
      startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
    } else {
      startForeground(NOTIF_ID, notification)
    }
    return START_NOT_STICKY
  }

  private fun ensureChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(NotificationManager::class.java)
    if (nm.getNotificationChannel(CHANNEL) == null) {
      nm.createNotificationChannel(
        NotificationChannel(CHANNEL, "Assistant tasks", NotificationManager.IMPORTANCE_LOW),
      )
    }
  }
}
