/**
 * docs/phase7-wave2.md §14.3 (Resolved 2026-09-25): `currentName` reads an identity's **current face**, not its
 * printed card title, per RRG 1.8 "Identity" (p. 23): "If a card refers to a hero or alter-ego by title, it refers
 * only to the identity with that title, and not to the other side of the card." Proven with two synthetic
 * identities: one whose hero and alter-ego titles share no word (Spider-Woman / Jessica Drew, the RRG's own
 * example) and one whose titles share a word (Doctor Strange / Stephen Strange — "Strange" appears in both), so a
 * naive substring match can't accidentally pass either case.
 */

import type { HeroIdentityCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import { applyCommand } from "./engine.js";
import { playerId } from "./ids.js";
import { currentName, mustPlayer, titleShowing } from "./query.js";
import { matchesQuery, type EffectContext } from "./select.js";
import type { GameState } from "./state.js";
import { stubIdentity } from "./testing/fixtures.js";
import { newGame } from "./testing/scenario.js";

const p1 = playerId("p1");

function identityWithFaces(id: string, heroTitle: string, alterEgoTitle: string): HeroIdentityCard {
  const stub = stubIdentity({ id, hp: 10, atk: 2, thw: 2, def: 2, rec: 3, heroHandSize: 5, alterEgoHandSize: 6 });
  return {
    ...stub,
    name: heroTitle,
    hero: { ...stub.hero, faceName: heroTitle },
    alterEgo: { ...stub.alterEgo, faceName: alterEgoTitle },
  };
}

const SPIDER_WOMAN = identityWithFaces("spider-woman", "Spider-Woman", "Jessica Drew");
const DOCTOR_STRANGE = identityWithFaces("doctor-strange", "Doctor Strange", "Stephen Strange");

function applyChangeForm(state: GameState): GameState {
  const result = applyCommand(state, { type: "changeForm", playerId: p1 });
  if (!result.ok) throw new Error(`changeForm rejected: ${result.error.message}`);
  return result.state;
}

const context = (): EffectContext => ({ selfInstanceId: null, controllerId: p1, event: null, bindings: {} });

describe("currentName reads an identity's current face (§14.3)", () => {
  it("Spider-Woman / Jessica Drew — titles share no word; setup starts in alter-ego form (RRG 1.8 'Setup', p. 41)", () => {
    const state = newGame({ identity: SPIDER_WOMAN });
    const id = mustPlayer(state, p1).identity.instanceId;
    expect(currentName(state, id)).toBe("Jessica Drew");
    expect(currentName(state, id)).not.toBe("Spider-Woman");
  });

  it("flips to the hero face on changeForm (once per round, RRG 1.8 'Form, Change Form', p. 21)", () => {
    const alterEgo = newGame({ identity: SPIDER_WOMAN });
    const id = mustPlayer(alterEgo, p1).identity.instanceId;
    expect(currentName(alterEgo, id)).toBe("Jessica Drew");

    const hero = applyChangeForm(alterEgo);
    expect(currentName(hero, id)).toBe("Spider-Woman");
    expect(currentName(hero, id)).not.toBe("Jessica Drew");
  });

  it('Doctor Strange / Stephen Strange — titles share the word "Strange"', () => {
    const alterEgo = newGame({ identity: DOCTOR_STRANGE });
    const id = mustPlayer(alterEgo, p1).identity.instanceId;
    expect(currentName(alterEgo, id)).toBe("Stephen Strange");

    const hero = applyChangeForm(alterEgo);
    expect(currentName(hero, id)).toBe("Doctor Strange");
    expect(currentName(hero, id)).not.toBe("Stephen Strange");
  });

  it("titleShowing is the same read as currentName (the two collapsed into one function)", () => {
    const alterEgo = newGame({ identity: SPIDER_WOMAN });
    const id = mustPlayer(alterEgo, p1).identity.instanceId;
    expect(titleShowing(alterEgo, id)).toBe(currentName(alterEgo, id));
    const hero = applyChangeForm(alterEgo);
    expect(titleShowing(hero, id)).toBe(currentName(hero, id));
  });

  it("TargetQuery.name matches only the identity's current face, not the other side of the card", () => {
    const alterEgo = newGame({ identity: SPIDER_WOMAN });
    const id = mustPlayer(alterEgo, p1).identity.instanceId;
    const ctx = context();
    expect(matchesQuery(alterEgo, id, { categories: ["identity"], name: "Jessica Drew" }, ctx)).toBe(true);
    expect(matchesQuery(alterEgo, id, { categories: ["identity"], name: "Spider-Woman" }, ctx)).toBe(false);

    const hero = applyChangeForm(alterEgo);
    expect(matchesQuery(hero, id, { categories: ["identity"], name: "Spider-Woman" }, ctx)).toBe(true);
    expect(matchesQuery(hero, id, { categories: ["identity"], name: "Jessica Drew" }, ctx)).toBe(false);
  });
});
