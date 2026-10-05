/** docs/phase7-wave7.md §3.62: the DSL builders for a three-face identity whose hero faces differ only by title. */

import { describe, expect, it } from "vitest";
import { heroAction, whenRevealed } from "./abilities.js";
import { changeForm, changeToHeroFormNamed, ifThen, placeThreat } from "./effects.js";
import { defineAbilities } from "./validate.js";
import { eachPlayer, faceNamed, theMainScheme, yourIdentity, youAreNamed } from "./values.js";

describe("changeToHeroFormNamed", () => {
  it("compiles to changeForm with the hero face's title, for you or another player", () => {
    expect(changeToHeroFormNamed("Archangel")).toEqual({
      kind: "changeForm",
      player: { kind: "controller" },
      heroForm: { named: "Archangel" },
    });
    expect(changeToHeroFormNamed("Archangel", eachPlayer)).toEqual({
      kind: "changeForm",
      player: eachPlayer,
      heroForm: { named: "Archangel" },
    });
  });

  it("a bare change form names no face: the engine asks among the faces not showing", () => {
    expect(changeForm()).toEqual({ kind: "changeForm", player: { kind: "controller" } });
  });
});

describe("faceNamed / youAreNamed", () => {
  it("read the title of the face showing", () => {
    expect(faceNamed(yourIdentity, "Archangel")).toEqual({ kind: "faceNamed", of: yourIdentity, name: "Archangel" });
    expect(youAreNamed("Angel")).toEqual(faceNamed(yourIdentity, "Angel"));
  });

  it("an obligation's 'if you are in [named] form, …; otherwise, change to [named] form' validates", () => {
    const registry = defineAbilities({
      "42024.when-revealed": whenRevealed(
        ifThen(youAreNamed("Archangel"), placeThreat(2, theMainScheme), changeToHeroFormNamed("Archangel")),
      ),
      "42005.metamorphosis-action": heroAction(changeForm()),
    });
    expect(Object.keys(registry)).toEqual(["42024.when-revealed", "42005.metamorphosis-action"]);
  });
});
