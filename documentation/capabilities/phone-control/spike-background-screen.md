# Spike: a background screen on the owner's phone

Status: proposed 2026-11-26, to be run by the owner; no Outlore code is involved.
Why: the [headless control research](../../research/phone-headless-control-2026-11-26.md) found that only the ADB shell identity can run other apps on a hidden display, and that only one phone (an Honor on Android 17) is known to have done it. Before any step 2 specification, prove it on the owner's phone.

## Stage A: with a computer, once (about 15 minutes)

Needs: the phone's USB debugging (or Wireless debugging) on, a computer with `adb` and scrcpy 3.0 or newer.
Record the phone's make, model and Android version first.

1. `scrcpy --new-display=1080x1920/320 --start-app=com.android.settings`: a window of the computer shows Settings. Pass: the phone's own screen does not change.
2. While it runs, use the phone normally (open another app, scroll, type): the computer's window keeps showing Settings, and your use of the phone is not interrupted. Pass or fail.
3. Click and type in the computer's window: the input reaches Settings only and no keyboard appears on the phone. Pass or fail.
4. Repeat step 1 with `--start-app=com.android.chrome`, then with an app of your own choice that is not from Google; note which draw, which show a launcher, which refuse or crash.
5. Lock the phone's screen for five minutes with scrcpy running; does the hidden display keep going?
6. Open a banking or payment app, and play protected video: expect black or refusal; note it.

Report: the model, the Android version, and the result of each step in one line.

## Stage B: only if stage A passes

A throwaway build of the Outlore app that does what `adb` did, without a computer: gets the shell identity through Shizuku or its own wireless-debugging link, creates the display, starts Settings on it and sends a frame to the host. Its checks are those in the research note's spike list. Not built; it needs the owner's choice between Shizuku and self-adb after stage A.
