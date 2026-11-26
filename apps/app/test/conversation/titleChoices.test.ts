import { describe, expect, it } from "vitest";
import { sameTitleChoices, type TitleChoice } from "../../src/conversation/titleChoices";

const choiceOf = (id: string, title: string, state?: TitleChoice<string>["state"]): TitleChoice<string> =>
  state === undefined ? { id, title } : { id, state, title };

describe("sameTitleChoices", () => {
  it("accepts two lists that would draw the same menu, whatever else changed in the quests behind them", () => {
    const previous = [choiceOf("a", "First", "Underway"), choiceOf("b", "Second", "Resting")];
    const next = [choiceOf("a", "First", "Underway"), choiceOf("b", "Second", "Resting")];
    expect(sameTitleChoices(previous, next)).toBe(true);
  });

  it("refuses a list whose title, state, order or length differs", () => {
    const base = [choiceOf("a", "First", "Underway"), choiceOf("b", "Second", "Resting")];
    expect(sameTitleChoices(base, [choiceOf("a", "Renamed", "Underway"), base[1] ?? choiceOf("b", "")])).toBe(false);
    expect(sameTitleChoices(base, [choiceOf("a", "First", "Resting"), base[1] ?? choiceOf("b", "")])).toBe(false);
    expect(sameTitleChoices(base, [...base].reverse())).toBe(false);
    expect(sameTitleChoices(base, base.slice(0, 1))).toBe(false);
  });
});
