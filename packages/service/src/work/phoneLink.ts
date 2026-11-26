import {
  type PhoneGroup,
  type PhoneOutcome,
  type PhoneToolName,
  phoneCallLimitMillis,
  phoneGroupOf,
} from "@outlore/contracts";
import { Context, Deferred, Effect, Layer, Option, Schema } from "effect";
import { SqlClient } from "effect/sql";
import { newId, Sessions } from "../core/index.ts";

// Phone control (phone-control specification, blueprint): the host's one place that knows which paired phone is
// connected and which groups its owner allows, and that carries a call to it and its answer back. Nothing is kept: the
// groups and the pending calls live in memory and end with the phone's session.

/** Why a phone call did nothing, as one plain sentence a thread can read and relay. */
export class PhoneRefusal extends Schema.TaggedError<PhoneRefusal>()("PhoneRefusal", { reason: Schema.String }) {}

const refuse = (reason: string) => new PhoneRefusal({ reason });

/** What the host asks of the phone link: who may be called, and the calls themselves. */
export class PhoneLink extends Context.Service<
  PhoneLink,
  {
    /** Records a phone's answer to a call; one from another device, or to a call no longer waiting, is ignored. */
    readonly answer: (deviceId: string, callId: string, outcome: PhoneOutcome) => Effect.Effect<void>;
    /**
     * Runs a tool on a phone and returns its value. `phone` names a paired phone and may be left out only while exactly
     * one connected phone has the group on. Fails at once when no such phone is connected, and after the call limit
     * when the phone does not answer.
     */
    readonly call: (
      group: PhoneGroup,
      tool: PhoneToolName,
      args: unknown,
      phone?: string,
    ) => Effect.Effect<unknown, PhoneRefusal>;
    /** Whether a connected paired phone has at least one group on, so threads are offered phone tools at all. */
    readonly isAvailable: Effect.Effect<boolean>;
    /** The tools a thread may be offered now: those of the groups a connected phone has on. */
    readonly offeredTools: Effect.Effect<ReadonlySet<PhoneToolName>>;
    /** Records the groups a phone's owner has switched on, as the phone reports them on connecting and at each change. */
    readonly setGroups: (deviceId: string, groups: ReadonlyArray<PhoneGroup>) => Effect.Effect<void>;
  }
>()("outlore/PhoneLink") {}

/** A call sent to a phone and not yet answered. */
type Pending = {
  readonly deferred: Deferred.Deferred<PhoneOutcome>;
  readonly deviceId: string;
};

const toolNames = Object.keys(phoneGroupOf) as ReadonlyArray<PhoneToolName>;

/** The link over the connected screens and the paired devices' names, waiting `limitMillis` for each answer. */
export const phoneLinkLayer = (limitMillis: number = phoneCallLimitMillis) =>
  Layer.effect(
    PhoneLink,
    Effect.gen(function* () {
      const sessions = yield* Sessions;
      const sql = yield* SqlClient.SqlClient;
      const groupsOf = new Map<string, ReadonlySet<PhoneGroup>>();
      const pending = new Map<string, Pending>();

      // A phone that left takes its groups with it, and a call waiting on it fails instead of waiting out the limit.
      const stopListening = sessions.onLeave((deviceId) => {
        groupsOf.delete(deviceId);
        for (const [callId, call] of pending) {
          if (call.deviceId !== deviceId) continue;
          pending.delete(callId);
          Effect.runSync(
            Deferred.succeed(call.deferred, { _tag: "Refused", reason: "The phone disconnected before it answered." }),
          );
        }
      });
      yield* Effect.addFinalizer(() => Effect.sync(stopListening));

      /** The paired phones connected now, which have told the host their groups. */
      const connected = () => sessions.devices().filter((deviceId) => groupsOf.has(deviceId));
      const hasOn = (deviceId: string, group: PhoneGroup) => groupsOf.get(deviceId)?.has(group) ?? false;

      /** Each paired device's name as the owner sees it; its kind when it has none. */
      const readNames = sql<{ id: string; kind: string; name: string }>`SELECT id, kind, name FROM paired_devices`.pipe(
        Effect.map((rows) => new Map(rows.map((row) => [row.id, row.name.trim() || row.kind]))),
        Effect.orDie,
      );

      /** The connected phone a call goes to, or why none does. */
      const chooseTarget = Effect.fnUntraced(function* (group: PhoneGroup, phone: string | undefined) {
        const names = yield* readNames;
        const labelOf = (deviceId: string) => names.get(deviceId) ?? "a paired phone";
        const wanted = phone?.trim() ?? "";
        if (wanted !== "") {
          const matches = [...names].filter(
            ([deviceId, label]) => label.toLowerCase() === wanted.toLowerCase() || deviceId === wanted,
          );
          const [match] = matches;
          if (match === undefined) return yield* refuse(`No paired phone is named "${wanted}".`);
          if (matches.length > 1)
            return yield* refuse(`Several paired phones are named "${wanted}". Rename one in Outlore.`);
          const [deviceId, label] = match;
          if (!connected().includes(deviceId)) return yield* refuse(`${label} is not connected. Open Outlore on it.`);
          if (!hasOn(deviceId, group))
            return yield* refuse(
              `${label} has not allowed ${group} use. The owner switches it on in Outlore on that phone.`,
            );
          return deviceId;
        }
        const phones = connected();
        const allowing = phones.filter((deviceId) => hasOn(deviceId, group));
        const [only] = allowing;
        if (only !== undefined && allowing.length === 1) return only;
        if (allowing.length > 1)
          return yield* refuse(
            `Several phones are connected: ${allowing.map(labelOf).join(", ")}. Name one in \`phone\`.`,
          );
        if (phones.length === 0) return yield* refuse("No phone connected. Open Outlore on the phone.");
        return yield* refuse(
          `No connected phone has allowed ${group} use. The owner switches it on in Outlore on the phone.`,
        );
      });

      const call = Effect.fnUntraced(function* (group: PhoneGroup, tool: PhoneToolName, args: unknown, phone?: string) {
        const deviceId = yield* chooseTarget(group, phone);
        const callId = yield* newId;
        const deferred = yield* Deferred.make<PhoneOutcome>();
        pending.set(callId, { deferred, deviceId });
        // Whatever ends the wait, an answer, the limit or an interruption, the call stops waiting.
        const outcome = yield* Effect.gen(function* () {
          if (!sessions.sendTo(deviceId, { _tag: "PhoneCall", args, callId, deviceId, tool }))
            return yield* refuse("No phone connected. Open Outlore on the phone.");
          const answered = yield* Deferred.await(deferred).pipe(Effect.timeoutOption(limitMillis));
          return Option.isSome(answered)
            ? answered.value
            : ({ _tag: "Refused", reason: `The phone did not answer in ${limitMillis / 1000} seconds.` } as const);
        }).pipe(Effect.ensuring(Effect.sync(() => void pending.delete(callId))));
        return outcome._tag === "Done" ? outcome.value : yield* refuse(outcome.reason);
      });

      const offeredTools = Effect.sync(
        (): ReadonlySet<PhoneToolName> =>
          new Set(toolNames.filter((tool) => connected().some((deviceId) => hasOn(deviceId, phoneGroupOf[tool])))),
      );

      return {
        answer: (deviceId, callId, outcome) =>
          Effect.suspend(() => {
            const waiting = pending.get(callId);
            // Only the phone a call was sent to answers it; a late answer finds nothing waiting.
            if (waiting === undefined || waiting.deviceId !== deviceId) return Effect.void;
            pending.delete(callId);
            return Deferred.succeed(waiting.deferred, outcome).pipe(Effect.asVoid);
          }),
        call,
        isAvailable: Effect.map(offeredTools, (tools) => tools.size > 0),
        offeredTools,
        // A report from a screen that is not connected (a late frame after it left) is not recorded.
        setGroups: (deviceId, groups) =>
          Effect.sync(() => {
            if (sessions.devices().includes(deviceId)) groupsOf.set(deviceId, new Set(groups));
          }),
      };
    }),
  );
