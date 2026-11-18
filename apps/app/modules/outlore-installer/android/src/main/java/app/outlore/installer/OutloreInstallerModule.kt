package app.outlore.installer

import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageManager
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.core.content.FileProvider
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.net.HttpURLConnection
import java.net.URL
import java.security.MessageDigest

/** The update could not be used; the message is what the owner reads in the Updates section. */
private class UpdateException(code: String, message: String) : CodedException(code, message, null)

/** Shares only the update cache with Android's installer. */
class UpdateFileProvider : FileProvider()

/**
 * What the phone's own system does for the app's updates (app-updates, The Android app): whether the network is
 * metered, whether Android lets this app install, downloading an APK with its SHA-512, and handing a checked APK to
 * Android's installer. Android always asks the owner to confirm an install; nothing here skips that.
 */
class OutloreInstallerModule : Module() {
  private val context: Context
    get() = appContext.reactContext ?: throw Exceptions.ReactContextLost()

  /** The only folder a download goes into; the FileProvider shares just this one. */
  private val updatesDirectory: File
    get() = File(context.cacheDir, "outlore-updates").apply { mkdirs() }

  override fun definition() = ModuleDefinition {
    Name("OutloreInstaller")

    Events("onDownloadProgress")

    Function("isNetworkMetered") {
      val connectivity = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
      // No network at all counts as metered: nothing is downloaded on a guess.
      connectivity.activeNetwork == null || connectivity.isActiveNetworkMetered
    }

    Function("isStoreInstall") {
      val installer = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        context.packageManager.getInstallSourceInfo(context.packageName).installingPackageName
      } else {
        @Suppress("DEPRECATION")
        context.packageManager.getInstallerPackageName(context.packageName)
      }
      installer == "com.android.vending"
    }

    Function("canInstallPackages") {
      canInstallPackages()
    }

    AsyncFunction("openInstallSettings") {
      val intent = Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${context.packageName}"))
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      (appContext.currentActivity ?: context).startActivity(intent)
    }

    // Downloads `url` into the updates folder and returns its SHA-512 as hex. The file is kept under its final name
    // only when the whole body arrived.
    AsyncFunction("download") Coroutine { url: String, fileName: String, userAgent: String, allowsMetered: Boolean ->
      withContext(Dispatchers.IO) {
        val address = URL(url)
        if (address.protocol != "https") throw UpdateException("INVALID_URL", "Updates must be downloaded over HTTPS.")
        val connectivity = context.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        val network = connectivity.activeNetwork
          ?: throw UpdateException("OFFLINE", "Connect to a network to download the update.")
        val capabilities = connectivity.getNetworkCapabilities(network)
        if (!allowsMetered && capabilities?.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED) != true) {
          throw UpdateException("ERR_METERED", "The network is metered.")
        }
        val target = apkFile(fileName)
        // An earlier download, finished or not, is never trusted: the folder is emptied first.
        updatesDirectory.listFiles()?.forEach { it.delete() }
        val partial = File(updatesDirectory, "$fileName.part")
        // Keeping the connection on this network prevents a dropped Wi-Fi connection from falling back to mobile data.
        val connection = (network.openConnection(address) as HttpURLConnection).apply {
          connectTimeout = 30_000
          readTimeout = 60_000
          instanceFollowRedirects = true
          setRequestProperty("User-Agent", userAgent)
        }
        try {
          if (connection.responseCode != HttpURLConnection.HTTP_OK) {
            throw UpdateException("DOWNLOAD_FAILED", "GitHub answered ${connection.responseCode} for $fileName.")
          }
          val total = connection.contentLengthLong
          val digest = MessageDigest.getInstance("SHA-512")
          var received = 0L
          var reported = -1
          connection.inputStream.use { input ->
            partial.outputStream().use { output ->
              val buffer = ByteArray(64 * 1024)
              while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                output.write(buffer, 0, count)
                digest.update(buffer, 0, count)
                received += count
                if (total > 0) {
                  val percent = minOf(100L, received * 100 / total).toInt()
                  if (percent != reported) {
                    reported = percent
                    sendEvent("onDownloadProgress", mapOf("fileName" to fileName, "percent" to percent))
                  }
                }
              }
            }
          }
          if (total > 0 && received != total) {
            throw UpdateException("DOWNLOAD_FAILED", "The download of $fileName stopped after $received of $total bytes.")
          }
          if (!partial.renameTo(target)) throw UpdateException("DOWNLOAD_FAILED", "Could not keep the downloaded $fileName.")
          digest.digest().joinToString("") { "%02x".format(it) }
        } catch (error: Exception) {
          partial.delete()
          target.delete()
          if (error is CodedException) throw error
          throw UpdateException("DOWNLOAD_FAILED", "Could not download $fileName: ${error.message ?: error.javaClass.simpleName}")
        } finally {
          connection.disconnect()
        }
      }
    }

    AsyncFunction("discard") { fileName: String ->
      apkFile(fileName).delete()
      File(updatesDirectory, "$fileName.part").delete()
    }

    // Checks that the file is a newer build of this app signed with the key of the installed one, then opens Android's
    // install confirmation. Android would refuse anything else, and says so less plainly.
    AsyncFunction("install") { fileName: String ->
      val file = apkFile(fileName)
      if (!file.isFile) throw UpdateException("NOT_DOWNLOADED", "The update is no longer downloaded. Check for updates again.")
      if (!canInstallPackages()) {
        throw UpdateException("NOT_ALLOWED", "Android has not been told to allow Outlore to install updates yet.")
      }
      checkIsUpdateOfThisApp(file)
      val uri = FileProvider.getUriForFile(context, "${context.packageName}.outlore.updates", file)
      val intent = Intent(Intent.ACTION_VIEW)
        .setDataAndType(uri, "application/vnd.android.package-archive")
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK)
      (appContext.currentActivity ?: context).startActivity(intent)
    }
  }

  // Android 7 uses a system-wide preference handled by its installer. The per-app allowance starts at Android 8.
  private fun canInstallPackages(): Boolean =
    Build.VERSION.SDK_INT < Build.VERSION_CODES.O || context.packageManager.canRequestPackageInstalls()

  /** The downloaded APK `fileName` names; a name with a folder in it is refused, so nothing outside the updates folder is read. */
  private fun apkFile(fileName: String): File {
    if (!Regex("^[A-Za-z0-9._-]+\\.apk$").matches(fileName)) {
      throw UpdateException("INVALID_NAME", "$fileName is not an APK name.")
    }
    return File(updatesDirectory, fileName)
  }

  private fun checkIsUpdateOfThisApp(file: File) {
    val manager = context.packageManager
    val flags = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) PackageManager.GET_SIGNING_CERTIFICATES else @Suppress("DEPRECATION") PackageManager.GET_SIGNATURES
    val archive = manager.getPackageArchiveInfo(file.path, flags)
      ?: throw UpdateException("NOT_AN_APK", "The downloaded file is not an Android app.")
    if (archive.packageName != context.packageName) {
      throw UpdateException("OTHER_APP", "The downloaded file is another app (${archive.packageName}), not Outlore.")
    }
    val installed = manager.getPackageInfo(context.packageName, flags)
    if (versionCodeOf(archive) <= versionCodeOf(installed)) {
      throw UpdateException("NOT_NEWER", "The downloaded app is not newer than the installed one, so Android would refuse it.")
    }
    val signers = signersOf(archive)
    if (signers.isEmpty() || signers != signersOf(installed)) {
      throw UpdateException(
        "OTHER_KEY",
        "The update is signed with another key than the installed Outlore, so Android refuses it. Uninstall Outlore once " +
          "and install this release by hand. Then pair the phone again. Later updates can be installed from Outlore.",
      )
    }
  }

  @Suppress("DEPRECATION")
  private fun versionCodeOf(info: PackageInfo): Long =
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) info.longVersionCode else info.versionCode.toLong()

  /** The certificates an app is signed with, as comparable text. */
  @Suppress("DEPRECATION")
  private fun signersOf(info: PackageInfo): Set<String> {
    val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
      info.signingInfo?.apkContentsSigners
    } else {
      info.signatures
    }
    return signatures.orEmpty().map { it.toCharsString() }.toSet()
  }
}
