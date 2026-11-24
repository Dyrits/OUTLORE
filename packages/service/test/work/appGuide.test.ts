import { HarnessName } from "@outlore/contracts";
import { describe, expect, it } from "vitest";
import { inactivityMissiveHours } from "../../src/core/index.ts";
import { harnessLabels } from "../../src/harness/index.ts";
import { guildmasterInstructionsOf } from "../../src/harness/instructions.ts";
import { guideTopics } from "../../src/work/appGuideTopics.ts";
import { topicsOf } from "../../src/work/guildmasterGuide.ts";
import { modeTerms } from "../../src/work/threadPermissionMode.ts";

const idsFor = (question: string) => topicsOf(question).map((topic) => topic.id);

describe("reading the app guide", () => {
  it("has unique topic ids, and every topic says what it answers", () => {
    const ids = guideTopics.map((topic) => topic.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const topic of guideTopics) {
      expect(topic.title.trim()).not.toBe("");
      expect(topic.summary.trim()).not.toBe("");
      expect(topic.body.length).toBeGreaterThan(100);
      expect(topic.keywords.length).toBeGreaterThan(0);
    }
  });

  it("speaks to the owner of quests, never of missions", () => {
    for (const topic of guideTopics)
      expect(`${topic.title} ${topic.summary} ${topic.body}`).not.toMatch(/\bmissions?\b/i);
  });

  it("names the settings screen as it is in the sidebar, the Workshop", () => {
    for (const topic of guideTopics) expect(topic.body).not.toMatch(/(?:in|open|from) the Charter\b/);
  });

  it("finds a topic by its id or its title", () => {
    expect(idsFor("rituals")).toEqual(["rituals"]);
    expect(idsFor("  Budgets ")).toEqual(["budgets"]);
    expect(idsFor("Lore and the Archive")).toEqual(["lore"]);
  });

  it.each([
    ["How do I make something run every morning?", "rituals"],
    ["can you schedule a weekly check for me", "rituals"],
    ["What does the ! do in the message box?", "messages"],
    ["how do I attach an image to a message", "messages"],
    ["How do I pair my phone with Outlore?", "pairing"],
    ["what is a realm", "realms"],
    ["Can a quest be in no realm?", "realms"],
    ["how much will this cost me, can I set a budget", "budgets"],
    ["Why did it ask me to Allow a command", "approvals"],
    ["how do I switch a thread from Claude to Codex", "companions"],
    ["where are the settings", "workshop"],
    ["what can you do for me", "chronicler"],
    ["my mac says the app is blocked", "install"],
    ["what does lore do and why did it fade", "lore"],
    ["what is an errand", "quests"],
  ])("answers %j from the %s topic", (question, id) => {
    expect(idsFor(question)).toContain(id);
    expect(idsFor(question)[0]).toBe(id);
  });

  it("returns nothing for a question the guide does not cover", () => {
    expect(idsFor("what is the capital of France")).toEqual([]);
    expect(idsFor("write me a poem")).toEqual([]);
  });

  describe("describing what is built today", () => {
    const body = (id: string) => guideTopics.find((topic) => topic.id === id)?.body ?? "";

    it("describes sandbox escapes, owner-kept settings, and Ritual creation accurately", () => {
      expect(body("approvals")).not.toMatch(/escape from the sandbox[^.]*always asks/i);
      expect(body("approvals")).toMatch(/outside the sandbox without asking/i);
      for (const id of ["chronicler", "workshop"]) expect(body(id)).toMatch(/outside the sandbox/i);
      expect(body("chronicler")).toMatch(/creating a Ritual always asks/i);
    });

    it("describes the actual handover replay boundary", () => {
      const text = body("companions");
      expect(text).not.toMatch(/full history/i);
      expect(text).toMatch(/images.*names/i);
      expect(text).toMatch(/tool calls.*not replayed/i);
      expect(text).toMatch(/oldest.*half/i);
    });

    it("describes browser pairing and names the Providers section", () => {
      expect(body("overview")).not.toMatch(/one user on one computer/i);
      expect(body("pairing")).toMatch(/browser/i);
      expect(body("pairing")).not.toMatch(/Not built yet:[^.]*phone web app/i);
      expect(body("companions")).toMatch(/Providers/);
      expect(body("companions")).not.toMatch(/Harnesses card/);
    });

    it("distinguishes quest and realm mentions and explains archiving an empty quest", () => {
      expect(body("quests")).toMatch(/realm.*context only/i);
      expect(body("realms")).not.toMatch(/never deletes a realm or a quest/i);
      expect(body("realms")).toMatch(/archiv.*empty quest.*delet/i);
    });

    it("does not promise the unbuilt own copy or one-button merge as available", () => {
      const text = body("realms");
      expect(text).toMatch(/own copy/i);
      expect(text).toMatch(/not built/i);
      expect(text).not.toMatch(/merged back with one button/i);
    });

    it("describes updates as checked and downloaded, with an explicit restart", () => {
      for (const id of ["install", "limits"]) expect(body(id)).not.toMatch(/there is no automatic update/i);
      expect(body("install")).toMatch(/Restart and update/);
    });

    it("lists the host folder picker and the host's terminal as built, and only the phone's own terminal as unbuilt", () => {
      const text = body("pairing");
      expect(text).not.toMatch(/Not built yet:[^.]*folder picker/i);
      expect(text).toMatch(/folder picker/i);
      expect(text).not.toMatch(/Not built yet:[^.]*the terminal on a host(,|, and | and )/i);
      expect(text).toMatch(/so is the terminal on a host/i);
      expect(text).toMatch(/Not built yet:[^.]*the terminal on the phone app itself/i);
    });

    it("says that a scheduled Ritual run that cannot start fails visibly without blocking the next one", () => {
      const text = body("rituals");
      expect(text).toMatch(/cannot start fails visibly/i);
      expect(text).toMatch(/Failed line with the reason/);
      expect(text).toMatch(/next scheduled run is not blocked/i);
    });

    it("says that each run is an errand beneath the Ritual, not a turn in its own quest", () => {
      const text = body("rituals");
      expect(text).toMatch(/run opens an errand beneath the Ritual/i);
      expect(text).not.toMatch(/run is a turn in its main thread/i);
      expect(text).not.toMatch(/Rituals place/i);
    });

    it("says that a pairing from another release is refused without spending the code", () => {
      expect(body("pairing")).toMatch(/same release.*refused.*code is not spent/i);
    });

    it("lets one owner pair several installations", () => {
      expect(body("limits")).not.toMatch(/one user on one computer/i);
    });

    it("names every harness, every permission mode, and the Missive quiet hours from their owning modules", () => {
      for (const name of HarnessName.literals) {
        const label = harnessLabels[name];
        expect(body("overview")).toContain(label);
        expect(body("companions")).toContain(label);
      }
      for (const mode of Object.keys(modeTerms)) expect(body("approvals")).toContain(mode);
      expect(body("quests")).toContain(`${inactivityMissiveHours.Attention} hours`);
      expect(body("quests")).toContain(`${inactivityMissiveHours.Resting} hours`);
      expect(body("quests")).toMatch(/check-in/i);
    });
  });

  it("returns at most two topics", () => {
    expect(topicsOf("quest realm ritual budget lore approval").length).toBeLessThanOrEqual(2);
  });

  it("is in Chronicler's instructions, with the rule to say so when it does not know", () => {
    const text = guildmasterInstructionsOf("thread-1");
    expect(text).toContain("read_app_guide");
    expect(text).toContain("say you do not know");
    expect(text).not.toContain("in the Charter");
  });
});
