import { maxBackups, type Tier } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import {
  appendedTo,
  canMoveIn,
  canRemoveAt,
  canRemoveFrom,
  chainLabelOf,
  chainOf,
  footerOf,
  maxChain,
  movedIn,
  newRunnerOf,
  openAfterMove,
  openAfterRemove,
  removedFrom,
  replacedIn,
  stackOf,
} from "../../src/editors/presetChain";
import type { Runner } from "../../src/editors/runner";

const runner = (model: string, effort: Runner["effort"] = "default"): Runner => ({
  accountId: null,
  effort,
  harness: "claude",
  model,
});
const stack = (...models: string[]): Tier => {
  const [primary = "claude-opus-5-5", ...backups] = models;
  return { ...runner(primary), backups: backups.map((model) => runner(model)) };
};
const modelsOf = (chain: ReadonlyArray<Runner>) => chain.map(({ model }) => model);

describe("building a preset's chain", () => {
  it("lists the primary Companion first and the backups after it", () => {
    expect(modelsOf(chainOf(stack("a", "b", "c")))).toEqual(["a", "b", "c"]);
  });

  it("turns back into the same stack", () => {
    const saved = stack("a", "b", "c");
    expect(stackOf(chainOf(saved))).toEqual(saved);
  });

  it("holds no stack when it is empty", () => {
    expect(stackOf([])).toBeNull();
  });

  it("makes the Companion moved to the top the primary and the old primary a backup", () => {
    const moved = stackOf(movedIn(chainOf(stack("a", "b", "c")), 2, 0));
    expect(moved?.model).toBe("c");
    expect(moved?.backups.map(({ model }) => model)).toEqual(["a", "b"]);
  });

  it("leaves the chain as it was when a Companion is moved outside it", () => {
    const chain = chainOf(stack("a", "b"));
    expect(movedIn(chain, 0, 2)).toBe(chain);
    expect(movedIn(chain, 1, -1)).toBe(chain);
  });

  it("replaces one Companion and keeps the others in place", () => {
    const next = replacedIn(chainOf(stack("a", "b", "c")), 1, runner("z"));
    expect(modelsOf(next)).toEqual(["a", "z", "c"]);
  });

  it("removes a Companion but never the last one", () => {
    expect(modelsOf(removedFrom(chainOf(stack("a", "b")), 0))).toEqual(["b"]);
    const only = chainOf(stack("a"));
    expect(canRemoveFrom(only)).toBe(false);
    expect(removedFrom(only, 0)).toBe(only);
  });

  it("prevents promoting an explicit-account backup into a primary that cannot hold an account", () => {
    const localPrimary = runner("claude-opus-5-5");
    const explicitBackup = { ...runner("claude-sonnet-5-5"), accountId: "account-1" as never };
    const localBackup = runner("claude-haiku-4-5");
    const chain = [localPrimary, explicitBackup, localBackup];
    expect(canMoveIn(chain, 1, 0, false)).toBe(false);
    expect(canMoveIn(chain, 0, 1, false)).toBe(false);
    expect(canRemoveAt(chain, 0, false)).toBe(false);
    expect(canMoveIn(chain, 2, 0, false)).toBe(true);
    expect(canMoveIn(chain, 1, 2, false)).toBe(true);
    expect(canMoveIn(chain, 1, 0, true)).toBe(true);
    expect(canRemoveAt(chain, 0, true)).toBe(true);
  });

  it("holds the primary and no more than the backups the contract allows", () => {
    expect(maxChain).toBe(6);
    expect(maxChain).toBe(maxBackups + 1);
    const full = chainOf(stack(...Array.from({ length: maxChain }, (_, index) => `model-${index}`)));
    expect(appendedTo(full, runner("extra"))).toBe(full);
    expect(appendedTo(full.slice(1), runner("extra"))).toHaveLength(maxChain);
  });
});

describe("naming a Companion in a row", () => {
  const accounts = (labels: ReadonlyArray<string>) =>
    ({
      harnesses: [
        {
          accounts: labels.map((label, index) => ({
            id: `account-${index}`,
            label,
            models: undefined,
            signIn: "SignedIn",
          })),
          models: [{ id: "claude-sonnet-5-5", label: "Sonnet 5.5" }],
          name: "claude",
          problem: null,
        },
      ],
    }) as never;

  it("puts the account in brackets after the model when the harness has several accounts", () => {
    const named = { ...runner("claude-sonnet-5-5", "high"), accountId: "account-1" as never };
    expect(chainLabelOf(accounts(["Professional", "Personal"]), named)).toBe("Sonnet 5.5 (Personal) · High");
  });

  it("names no account when the harness has only one", () => {
    expect(chainLabelOf(accounts(["Professional"]), runner("claude-sonnet-5-5", "high"))).toBe("Sonnet 5.5 · High");
  });
});

describe("starting a new row", () => {
  const harnesses = {
    harnesses: [
      {
        accounts: [{ id: "account-0", label: "Professional", models: undefined, signIn: "SignedIn" }],
        models: [{ id: "claude-sonnet-5-5", label: "Sonnet 5.5" }],
        name: "claude",
        problem: null,
      },
    ],
  } as never;

  it("takes the first harness's first account and first model", () => {
    expect(newRunnerOf(harnesses)).toEqual({
      accountId: "account-0",
      effort: "default",
      harness: "claude",
      model: "claude-sonnet-5-5",
    });
  });

  it("takes no account where accounts are not shown, as for the Workshop's default", () => {
    expect(newRunnerOf(harnesses, false).accountId).toBeNull();
  });

  it("takes the selected account's first model when that account lists its own models", () => {
    const accountScoped = {
      harnesses: [
        {
          accounts: [
            {
              id: "account-0",
              label: "Personal",
              models: [{ id: "claude-haiku-4-5", label: "Haiku 4.5" }],
              signIn: "SignedIn",
            },
          ],
          models: [{ id: "claude-opus-5-5", label: "Opus 5.5" }],
          name: "claude",
          problem: null,
        },
      ],
    } as never;
    expect(newRunnerOf(accountScoped)).toEqual({
      accountId: "account-0",
      effort: "default",
      harness: "claude",
      model: "claude-haiku-4-5",
    });
    expect(newRunnerOf(accountScoped, false)).toEqual({
      accountId: null,
      effort: "default",
      harness: "claude",
      model: "claude-opus-5-5",
    });
  });

  it("falls back to no account before the harnesses are read", () => {
    expect(newRunnerOf(null).accountId).toBeNull();
  });
});

describe("unfolding a row of a chain", () => {
  it("follows its Companion when it moves", () => {
    expect(openAfterMove("chain-1", 1, 3)).toBe("chain-3");
    expect(openAfterMove("chain-3", 3, 0)).toBe("chain-0");
  });

  it("shifts by one when another Companion moves past it", () => {
    expect(openAfterMove("chain-2", 0, 3)).toBe("chain-1");
    expect(openAfterMove("chain-2", 4, 1)).toBe("chain-3");
  });

  it("stays when the move is on either side of it", () => {
    expect(openAfterMove("chain-0", 2, 4)).toBe("chain-0");
    expect(openAfterMove("chain-5", 0, 2)).toBe("chain-5");
  });

  it("keeps a fold that is not a row, or none", () => {
    expect(openAfterMove("main", 0, 2)).toBe("main");
    expect(openAfterMove(null, 0, 2)).toBeNull();
    expect(openAfterRemove(null, 1)).toBeNull();
  });

  it("closes with its Companion when it is removed, and shifts up for one removed before it", () => {
    expect(openAfterRemove("chain-2", 2)).toBeNull();
    expect(openAfterRemove("chain-3", 1)).toBe("chain-2");
    expect(openAfterRemove("chain-1", 3)).toBe("chain-1");
  });
});

describe("showing the footer of the chain editor", () => {
  it("keeps controls inactive while an existing companion is unchanged", () => {
    expect(footerOf({ canSaveAs: true, isChanged: false, isNew: false })).toMatchObject({
      canOverwrite: true,
      isDirty: false,
      status: "Nothing changed yet.",
    });
  });

  it("enables Overwrite once an existing companion changed", () => {
    expect(footerOf({ canSaveAs: true, isChanged: true, isNew: false })).toMatchObject({
      canOverwrite: true,
      isDirty: true,
      status: "You changed this companion.",
    });
  });

  it("offers no Overwrite for a companion not made yet", () => {
    expect(footerOf({ canSaveAs: true, isChanged: false, isNew: true })).toMatchObject({
      canOverwrite: false,
      isDirty: true,
      status: "Not saved yet.",
    });
  });
});
