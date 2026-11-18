import type { HostUpdate } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import {
  hostUpdateQuestion,
  hostUpdateTextOf,
  initialHostUpdate,
  isHostOlder,
  nextHostUpdate,
} from "../../src/foundation/hostUpdate";

// Updating a host from a device of a later release (app-updates): when the host is older the banner offers it, and
// the update link's answers drive what the device shows until the host is back on this device's release.

const device = "0.1.10-Prototype";
const read = (release: string, status: HostUpdate["status"]): { type: "read"; update: HostUpdate } => ({
  type: "read",
  update: { release, status },
});

describe("whether to offer updating the host", () => {
  it("offers only when the host's release is older than this device's", () => {
    expect(isHostOlder("0.1.9-Prototype", device)).toBe(true);
    expect(isHostOlder("0.1.11-Prototype", device)).toBe(false);
    expect(isHostOlder(device, device)).toBe(false);
  });

  it("does not offer for a release it cannot compare", () => {
    expect(isHostOlder("development", device)).toBe(false);
    expect(isHostOlder("0.1.9-Prototype", "development")).toBe(false);
  });

  it("offers after reading an older host that can update", () => {
    const state = nextHostUpdate(initialHostUpdate, read("0.1.9-Prototype", { _tag: "Idle", note: null }), device);
    expect(state).toEqual({ _tag: "Offered", hostRelease: "0.1.9-Prototype" });
  });

  it("keeps today's text for a newer host and for a host that cannot update itself", () => {
    expect(nextHostUpdate(initialHostUpdate, read("0.1.11-Prototype", { _tag: "Idle", note: null }), device)).toEqual({
      _tag: "NotOffered",
      reason: null,
    });
    expect(
      nextHostUpdate(
        initialHostUpdate,
        read("0.1.9-Prototype", { _tag: "Unsupported", reason: "Updates apply to the installed app." }),
        device,
      ),
    ).toEqual({ _tag: "NotOffered", reason: "The host cannot update itself: Updates apply to the installed app." });
  });

  it("says the host is too old when it does not know the request", () => {
    expect(nextHostUpdate(initialHostUpdate, { type: "tooOld" }, device)).toEqual({ _tag: "TooOld" });
    expect(hostUpdateTextOf({ _tag: "TooOld" })).toBe(
      "This host is too old to update from here; update it on the host once, then this works.",
    );
  });

  it("keeps probing while the host cannot be reached", () => {
    expect(nextHostUpdate(initialHostUpdate, { type: "disconnected" }, device)).toEqual({ _tag: "Probing" });
  });
});

describe("following the update", () => {
  const started = nextHostUpdate({ _tag: "Offered", hostRelease: "0.1.9-Prototype" }, { type: "start" }, device);

  it("asks first and says that running turns finish first", () => {
    expect(hostUpdateQuestion).toContain("running turns finish first");
    expect(started).toMatchObject({ _tag: "Updating", isReconnecting: false, update: null });
  });

  it("shows each step of the host's update", () => {
    const steps: [HostUpdate["status"], string][] = [
      [{ _tag: "Checking" }, "Looking for the new release…"],
      [{ _tag: "Downloading", percent: 40, version: "0.1.10-Prototype" }, "Downloading 40%"],
      [{ _tag: "Ready", version: "0.1.10-Prototype" }, "Downloaded. Starting the install…"],
      [
        { _tag: "WaitingForTurns", runningCount: 2, version: "0.1.10-Prototype" },
        "Waiting for 2 running turns to finish",
      ],
      [
        { _tag: "WaitingForTurns", runningCount: 1, version: "0.1.10-Prototype" },
        "Waiting for 1 running turn to finish",
      ],
      [{ _tag: "Installing", version: "0.1.10-Prototype" }, "Installing"],
      [{ _tag: "Failed", message: "GitHub did not answer." }, "GitHub did not answer."],
      [{ _tag: "Idle", note: null }, "The host found no newer release. Update it on the host."],
      [{ _tag: "Idle", note: "Release 0.1.10 has no installer." }, "Release 0.1.10 has no installer."],
    ];
    for (const [status, text] of steps) {
      const state = nextHostUpdate(started, read("0.1.9-Prototype", status), device);
      expect(hostUpdateTextOf(state)).toBe(text);
    }
  });

  it("says reconnecting when the link drops while the host installs, and keeps the last step otherwise", () => {
    const installing = nextHostUpdate(
      started,
      read("0.1.9-Prototype", { _tag: "Installing", version: device }),
      device,
    );
    const dropped = nextHostUpdate(installing, { type: "disconnected" }, device);
    expect(dropped).toMatchObject({ _tag: "Updating", isReconnecting: true });
    expect(hostUpdateTextOf(dropped)).toBe("Reconnecting…");
    expect(
      nextHostUpdate(dropped, read("0.1.9-Prototype", { _tag: "Installing", version: device }), device),
    ).toMatchObject({
      isReconnecting: false,
    });
  });

  it("is done when the host answers on this device's release, after the restart or by an update on the host itself", () => {
    const dropped = nextHostUpdate(started, { type: "disconnected" }, device);
    expect(nextHostUpdate(dropped, read(device, { _tag: "Idle", note: null }), device)).toEqual({
      _tag: "Updated",
      release: device,
    });
    expect(nextHostUpdate(initialHostUpdate, read(device, { _tag: "Idle", note: null }), device)).toEqual({
      _tag: "Updated",
      release: device,
    });
  });

  it("lets the owner try again after a failure, and not start twice while it runs", () => {
    const failed = nextHostUpdate(started, read("0.1.9-Prototype", { _tag: "Failed", message: "No." }), device);
    expect(nextHostUpdate(failed, { type: "start" }, device)).toMatchObject({ _tag: "Updating", update: null });
    const running = nextHostUpdate(started, read("0.1.9-Prototype", { _tag: "Installing", version: device }), device);
    expect(nextHostUpdate(running, { type: "start" }, device)).toBe(running);
  });
});
