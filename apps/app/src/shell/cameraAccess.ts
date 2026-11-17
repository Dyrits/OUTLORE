/** The part of the camera permission the scanner reads (`expo-camera`'s `PermissionResponse`). */
type CameraPermission = {
  readonly canAskAgain: boolean;
  readonly granted: boolean;
  readonly status: string;
};

export type CameraAccess =
  | { readonly kind: "loading" }
  | { readonly kind: "granted" }
  /** Not allowed yet, and the system will show its question. */
  | { readonly kind: "ask" }
  /** Refused, and the system will not ask again: only the phone's settings can allow it. */
  | { readonly kind: "blocked"; readonly message: string };

const blockedMessage =
  "Camera access is off for Outlore. Open Settings, choose Outlore, and turn on Camera, then scan again. You can also paste the pairing code or link instead.";

/** What the scanner shows for the camera permission: the camera, the system's question, or how to allow it. */
export function cameraAccessOf(permission: CameraPermission | null): CameraAccess {
  if (permission === null) return { kind: "loading" };
  if (permission.granted) return { kind: "granted" };
  if (permission.canAskAgain) return { kind: "ask" };
  return { kind: "blocked", message: blockedMessage };
}
