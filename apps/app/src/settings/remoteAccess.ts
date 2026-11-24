import type { PairedDevice, RelayStatus, RemoteAccessView } from "@outlore/contracts";

// The words of Charter's remote access section (device-pairing, Behavior).

/** What the relay connection's state means for the owner. */
export const relayStatusTextOf = (status: RelayStatus, isEnabled: boolean) => {
  if (!isEnabled) return "Off. No other device can reach this computer.";
  return (
    {
      Connected: "Ready. A paired device can reach this computer from any network.",
      Connecting: "Connecting to the relay…",
      Off: "Starting…",
      Unreachable: "The relay cannot be reached. Trying again; paired devices cannot connect meanwhile.",
    } satisfies Record<RelayStatus, string>
  )[status];
};

/** How long ago, in the largest whole unit; "just now" within a minute. */
export const agoOf = (then: number, now: number) => {
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} days ago`;
};

/** A paired device's second line: what it is, and whether it is connected or when it was last active. */
export const deviceLineOf = (device: PairedDevice, now: number) => {
  const kind = (
    { browser: "Browser", desktop: "Desktop", phone: "Phone" } satisfies Record<typeof device.kind, string>
  )[device.kind];
  // Direct means its messages no longer cross the relay (device-pairing, Direct path).
  if (device.isConnected) return `${kind} · connected now${device.isDirect ? ", direct" : ""}`;
  return device.lastActiveAt === null
    ? `${kind} · never connected`
    : `${kind} · last active ${agoOf(device.lastActiveAt, now)}`;
};

/** A pairing code's remaining life: "works once, expires in 9 min", or that it expired. */
export const codeLifeOf = (expiresAt: number, now: number) => {
  const minutes = Math.ceil((expiresAt - now) / 60_000);
  if (minutes <= 0) return "This code has expired. Make a new one.";
  return `Works once and expires in ${minutes} min.`;
};

/** Where the owner creates a Cloudflare API token. */
export const cloudflareTokensUrl = "https://dash.cloudflare.com/profile/api-tokens";

/** Which relay the host uses: the shared one, or the owner's own on their Cloudflare account. */
export const relayLineOf = (view: Pick<RemoteAccessView, "isOwnRelay" | "relayOrigin">) => {
  if (!view.isOwnRelay) {
    return "Shared relay, run by the Outlore project. It carries only encrypted traffic and cannot read it.";
  }
  const host = URL.canParse(view.relayOrigin) ? new URL(view.relayOrigin).host : view.relayOrigin;
  return `Your own relay, on your Cloudflare account: ${host}`;
};

/** Where the web app opens, said in Charter's relay section; an own relay does not serve it. */
export const webAppLineOf = (view: Pick<RemoteAccessView, "isOwnRelay" | "webAppUrl">) =>
  `Web app: ${view.webAppUrl}. Open it in any browser and paste a pairing code or link.${
    view.isOwnRelay ? " It is served by the shared relay, not by your own." : ""
  }`;

/** What to do with a pairing code just made: scan the QR code, open a link, or paste the code. */
export const pairingHelp =
  "Scan the code with a phone camera, or open a link on the other device. Or paste the code, or a link, under Add a host in the other Outlore.";

/** A pairing link is as secret as the code: whoever has it can pair until it works once or expires. */
export const pairingSecrecyNotice =
  "Anyone with this link or code can pair with this computer until it expires. Share it only with the device you mean to pair.";

/** What deploying the owner's own relay does and leaves behind, said before the token is used. */
export const ownRelayNoticeOf = (pairedDevices: number) => {
  const devices =
    pairedDevices === 0
      ? ""
      : ` ${pairedDevices} paired ${pairedDevices === 1 ? "device" : "devices"} will have to pair again, because ${pairedDevices === 1 ? "it" : "they"} reach this computer through the shared relay.`;
  return `Outlore uses the token once, to put a Worker named outlore-relay on your account (and a workers.dev address, if you have none), and does not keep it.${devices}`;
};
