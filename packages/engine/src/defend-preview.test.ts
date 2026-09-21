/**
 * `defendPreview()` — each defend option's damage as a range over the facedown boost cards.
 *
 * Every test is tied to the RRG 1.8 page it is checking; page numbers are the printed ones in
 * `mc_rulesreference_v18_compressed.pdf` (they match the PDF's own page indexes).
 */

import { flat, type AnyCard, type CardId } from "@mc/content";
import type { EngineDeps } from "./abilities.js";
import type { Command } from "./commands.js";
import { defendPreview, type DefendOptionPreview } from "./defend-preview.js";
import { applyCommand } from "./engine.js";
import type { GameEvent } from "./events.js";
import { playerId, type InstanceId } from "./ids.js";
import { activeVillain, mustPlayer } from "./query.js";
import { shuffle } from "./rng.js";
import type { CardInstance, GameState } from "./state.js";
import { depsOf, stubAbility, type StubAbility } from "./testing/abilities.js";
import { stubAlly, stubMainScheme, stubTreachery, stubVillain } from "./testing/fixtures.js";
import { giveCard, newGame, payFor, resolvePending, RESOURCE, runWith, settleUntil } from "./testing/scenario.js";

const p1 = playerId("p1");
const endTurn: Command = { type: "endTurn", playerId: p1 };
const toHero: Command = { type: "changeForm", playerId: p1 };

const SCHEME = stubMainScheme({
  id: "scheme",
  stages: [{ startingThreat: flat(0), targetThreat: flat(200), acceleration: flat(0) }],
});
/** Two boost values, so a one-card bound is a real range rather than a point. */
const B0 = stubTreachery({ id: "b0", boostIcons: 0 });
const B3 = stubTreachery({ id: "b3", boostIcons: 3 });
const MIXED: readonly CardId[] = Array.from({ length: 24 }, (_, index) => (index % 2 === 0 ? B0.id : B3.id));

const villainWith = (atk: number, keywords: readonly { readonly name: string; readonly value?: number }[] = []) =>
  stubVillain({ id: "villain", stages: [{ hp: flat(200), atk, sch: 1, keywords: keywords as never }] });

interface AtDefense {
  readonly state: GameState;
  readonly deps: EngineDeps;
  readonly ally: InstanceId;
  readonly hero: InstanceId;
  readonly villain: InstanceId;
  readonly options: readonly DefendOptionPreview[];
}

/**
 * A game parked on the defend prompt of the first villain attack, with one ally in play, so every option the prompt
 * offers — no defense, the hero, the ally — has something different to say.
 */
function atDefense(
  options: {
    readonly villain?: ReturnType<typeof stubVillain>;
    readonly ally?: ReturnType<typeof stubAlly>;
    readonly encounterDeck?: readonly CardId[];
    readonly extraCards?: readonly AnyCard[];
    readonly abilities?: readonly StubAbility[];
  } = {},
): AtDefense {
  const ally = options.ally ?? stubAlly({ id: "buddy", cost: 2, atk: 1, thw: 1, hp: 3, resources: 1 });
  const villain = options.villain ?? villainWith(4);
  const deps = depsOf(...(options.abilities ?? []));
  const start = newGame({
    villain,
    mainScheme: SCHEME,
    extraCards: [B0, B3, ally, ...(options.extraCards ?? [])],
    encounterDeck: options.encounterDeck ?? MIXED,
    deck: [...Array.from({ length: 18 }, () => RESOURCE.id), ...Array.from({ length: 6 }, () => ally.id)],
    deps,
  });
  const given = giveCard(start, p1, ally.id);
  const played = runWith(
    deps,
    given.state,
    toHero,
    {
      type: "playCard",
      playerId: p1,
      cardInstanceId: given.id,
      payment: payFor(given.state, p1, 2),
      attachToInstanceId: null,
    },
    endTurn,
  );
  const state = settleUntil(played, "declareDefender", deps);
  const preview = defendPreview(state, deps);
  if (!preview) throw new Error("expected a defend preview");
  return {
    state,
    deps,
    ally: given.id,
    hero: mustPlayer(state, p1).identity.instanceId,
    villain: activeVillain(state).instanceId,
    options: preview,
  };
}

const optionFor = (at: AtDefense, defender: InstanceId | null): DefendOptionPreview => {
  const found = at.options.find((option) => option.defenderInstanceId === defender);
  if (!found) throw new Error(`no option for ${defender ?? "decline"}`);
  return found;
};
const patch = (state: GameState, id: InstanceId, changes: Partial<CardInstance>): GameState => ({
  ...state,
  instances: { ...state.instances, [id]: { ...(state.instances[id] as CardInstance), ...changes } },
});

test("no defend choice open, no preview", () => {
  expect(defendPreview(newGame({ villain: villainWith(4), mainScheme: SCHEME }))).toBeNull();
});

test("one option per answer the prompt offers, and nothing else", () => {
  const at = atDefense();
  expect(at.options.map((option) => option.optionId)).toEqual(
    at.state.pendingChoice?.options.map((option) => option.optionId),
  );
  expect(at.options.map((option) => option.defenderInstanceId)).toEqual(
    expect.arrayContaining([null, at.hero, at.ally]),
  );
});

// ---------------------------------------------------------------------------
// The boost bound. RRG 1.8 "Attack (Enemy Activation)" steps 1–3 (p. 9), "Boost" (p. 11).
// ---------------------------------------------------------------------------

test("the facedown boost count is exact: it is what the attack then flips", () => {
  const at = atDefense();
  const { boost } = at.options[0]!;
  expect(boost.facedownCount).toBe(1);

  const resolved = applyCommand(
    at.state,
    { type: "resolveChoice", playerId: p1, choiceId: at.state.pendingChoice!.choiceId, selectedOptionIds: ["decline"] },
    at.deps,
  );
  const flipped = (resolved.ok ? resolved.events : []).filter((event) => event.type === "boostCardFlipped");
  expect(flipped).toHaveLength(boost.facedownCount);
});

test("the bound is over the unseen pool, and the real damage lands inside a band", () => {
  const at = atDefense();
  const decline = optionFor(at, null);
  // The deck holds 0-icon and 3-icon cards only, so one boost card is worth 0 to 3.
  expect(decline.boost.min).toBe(0);
  expect(decline.boost.max).toBe(3);
  expect(decline.boost.scope).toBe("unseen");
  expect(decline.boost.poolSize).toBeGreaterThan(0);

  const resolved = applyCommand(
    at.state,
    { type: "resolveChoice", playerId: p1, choiceId: at.state.pendingChoice!.choiceId, selectedOptionIds: ["decline"] },
    at.deps,
  );
  const attack = (resolved.ok ? resolved.events : []).find(
    (event): event is Extract<GameEvent, { type: "attackResolved" }> => event.type === "attackResolved",
  );
  expect(attack).toBeDefined();

  const band = decline.bands.find(
    (entry) => attack!.boostIcons >= entry.boostFrom && attack!.boostIcons <= entry.boostTo,
  );
  expect(band, `no band covers ${attack!.boostIcons} boost icons`).toBeDefined();
  expect(band!.damageDealt).toBe(attack!.damageDealt);
  expect(attack!.damageDealt).toBeGreaterThanOrEqual(decline.bands[0]!.damageDealt);
  expect(attack!.damageDealt).toBeLessThanOrEqual(decline.bands[decline.bands.length - 1]!.damageDealt);
});

test("a wider scope is a looser bound over the same attack, never a tighter one", () => {
  const at = atDefense();
  const wide = defendPreview(at.state, at.deps, { scope: "wholeSet" })!;
  expect(wide[0]!.boost.scope).toBe("wholeSet");
  expect(wide[0]!.boost.poolSize).toBeGreaterThanOrEqual(at.options[0]!.boost.poolSize);
  expect(wide[0]!.boost.max).toBeGreaterThanOrEqual(at.options[0]!.boost.max);
  expect(wide[0]!.boost.min).toBeLessThanOrEqual(at.options[0]!.boost.min);
});

/**
 * RRG 1.8 "Boost, Boost Icon" (p. 11) and "Star Icon" (p. 40): a star is *not* a boost icon and does not contribute
 * to the enemy's ATK, and damage dealt by a "Boost" ability is not damage dealt by the activation. So the numbers
 * must not move, and the possibility is reported as a count rather than folded in.
 */
test("a Boost ability in the pool is reported, and never raises the damage bound", () => {
  const boostAbility = stubAbility("star", { trigger: { kind: "boost" }, effects: [] });
  const STAR = stubTreachery({ id: "star", boostIcons: 0, abilities: [boostAbility.ref] });
  const withStar = atDefense({
    extraCards: [STAR],
    abilities: [boostAbility],
    encounterDeck: Array.from({ length: 24 }, (_, index) =>
      index % 3 === 2 ? STAR.id : index % 2 === 0 ? B0.id : B3.id,
    ),
  });
  const plain = atDefense();

  expect(withStar.options[0]!.boost.mayTriggerBoostAbility).toBe(true);
  expect(withStar.options[0]!.boost.poolWithBoostAbility).toBeGreaterThan(0);
  expect(withStar.options[0]!.boost.max).toBe(plain.options[0]!.boost.max);
  expect(plain.options[0]!.boost.mayTriggerBoostAbility).toBe(false);
  expect(plain.options[0]!.boost.poolWithBoostAbility).toBe(0);
});

test("shuffling the deck the boost cards came out of changes nothing", () => {
  const at = atDefense();
  let rng = { value: 7, draws: 0 };
  const permuted: GameState = {
    ...at.state,
    encounterDecks: Object.fromEntries(
      Object.entries(at.state.encounterDecks).map(([id, piles]) => {
        const [deck, next] = shuffle(piles.deck, rng);
        rng = next;
        return [id, { ...piles, deck }];
      }),
    ),
  };
  expect(permuted.encounterDecks).not.toEqual(at.state.encounterDecks);
  expect(defendPreview(permuted, at.deps)).toEqual(at.options);
});

// ---------------------------------------------------------------------------
// Who reduces, who takes it. RRG 1.8 p. 9 steps 4–5, p. 15 "Defense (DEF)", p. 31 "Overkill".
// ---------------------------------------------------------------------------

test("a hero's basic defense reduces by DEF; an ally's never does, and nothing carries to the identity", () => {
  const at = atDefense();
  const hero = optionFor(at, at.hero);
  const ally = optionFor(at, at.ally);
  const decline = optionFor(at, null);

  expect(hero.baseAtk).toBe(4);
  expect(hero.defenseReduction).toBe(2);
  expect(hero.targetInstanceId).toBe(at.hero);
  expect(hero.exhausts).toEqual([at.hero]);
  expect(hero.bands[0]!.damageDealt).toBe(2);

  // An ally defender takes all of it, with no reduction at all (p. 9 step 5).
  expect(ally.defenseReduction).toBe(0);
  expect(ally.targetInstanceId).toBe(at.ally);
  expect(ally.exhausts).toEqual([at.ally]);
  expect(ally.bands[0]!.damageDealt).toBe(4);
  // 3 hit points against 4 damage: defeated in every band, and without overkill the excess is simply lost (p. 31).
  for (const band of ally.bands) {
    expect(band.defeated).toBe(true);
    expect(band.overkillToInstanceId).toBeNull();
    expect(band.overkillAmount).toBe(0);
  }

  // Declining leaves the attack's own target, with no reduction.
  expect(decline.defenderInstanceId).toBeNull();
  expect(decline.basicDefense).toBe(false);
  expect(decline.defenseReduction).toBe(0);
  expect(decline.exhausts).toEqual([]);
  expect(decline.targetInstanceId).toBe(at.hero);
});

test("with overkill, the excess from a defeated ally defender carries to its controller's hero", () => {
  const at = atDefense({ villain: villainWith(4, [{ name: "overkill" }]) });
  const ally = optionFor(at, at.ally);
  for (const band of ally.bands) {
    expect(band.defeated).toBe(true);
    expect(band.overkillToInstanceId).toBe(at.hero);
    // 3 hit points, so the excess is whatever the attack dealt beyond them.
    expect(band.overkillAmount).toBe(band.damageTaken - 3);
  }
});

// ---------------------------------------------------------------------------
// Statuses that change the public arithmetic. RRG 1.8 "Tough" (p. 44), "Retaliate X" (p. 38), "Ranged" (p. 37).
// ---------------------------------------------------------------------------

test("a tough hero keeps the status in the band where the damage reduces to 0, and spends it where it doesn't", () => {
  // ATK 1 against DEF 2: no boost icons at all is 0 damage, which by p. 9 step 5 leaves the tough status in place.
  const at = atDefense({ villain: villainWith(1) });
  const tough = patch(at.state, at.hero, { statuses: { stunned: 0, confused: 0, tough: 1 } });
  const options = defendPreview(tough, at.deps)!;
  const hero = options.find((option) => option.defenderInstanceId === at.hero)!;

  const zero = hero.bands.find((band) => band.damageDealt === 0)!;
  expect(zero).toBeDefined();
  expect(zero.toughSpent).toBe(false);
  expect(zero.damageTaken).toBe(0);

  const hit = hero.bands.find((band) => band.damageDealt > 0)!;
  expect(hit).toBeDefined();
  expect(hit.toughSpent).toBe(true);
  // Tough prevents all of it (p. 44) — the damage is still *dealt*, just not taken.
  expect(hit.damageTaken).toBe(0);
});

test("retaliate is the same in every band the defender survives, and 0 where it doesn't", () => {
  const retaliator = stubAlly({
    id: "spiky",
    cost: 2,
    atk: 1,
    thw: 1,
    hp: 6,
    resources: 1,
    keywords: [{ name: "retaliate", value: 2 }],
  });
  // ATK 3 plus 0–3 boost against 6 hit points: it survives at the bottom of the range and falls at the top.
  const at = atDefense({ villain: villainWith(3), ally: retaliator });
  const ally = optionFor(at, at.ally);

  const survives = ally.bands.filter((band) => !band.defeated);
  const falls = ally.bands.filter((band) => band.defeated);
  expect(survives.length).toBeGreaterThan(0);
  expect(falls.length).toBeGreaterThan(0);
  for (const band of survives) expect(band.retaliateToAttacker).toBe(2);
  for (const band of falls) expect(band.retaliateToAttacker).toBe(0);
});

test("a ranged attacker takes no retaliate at all", () => {
  const retaliator = stubAlly({
    id: "spiky",
    cost: 2,
    atk: 1,
    thw: 1,
    hp: 6,
    resources: 1,
    keywords: [{ name: "retaliate", value: 2 }],
  });
  const at = atDefense({ villain: villainWith(3, [{ name: "ranged" }]), ally: retaliator });
  for (const band of optionFor(at, at.ally).bands) expect(band.retaliateToAttacker).toBe(0);
});

// ---------------------------------------------------------------------------
// The preview and the resolver share one implementation of the arithmetic.
// ---------------------------------------------------------------------------

test("the damage the attack actually deals is the damage the chosen option's band predicted", () => {
  for (const defender of ["hero", "ally", "decline"] as const) {
    const at = atDefense();
    const pick = defender === "hero" ? at.hero : defender === "ally" ? at.ally : null;
    const option = optionFor(at, pick);
    const after = resolvePending(at.state, [option.optionId], at.deps);
    const events = applyCommand(
      at.state,
      {
        type: "resolveChoice",
        playerId: p1,
        choiceId: at.state.pendingChoice!.choiceId,
        selectedOptionIds: [option.optionId],
      },
      at.deps,
    );
    expect(after).toBeDefined();
    const attack = (events.ok ? events.events : []).find(
      (event): event is Extract<GameEvent, { type: "attackResolved" }> => event.type === "attackResolved",
    )!;
    const band = option.bands.find(
      (entry) => attack.boostIcons >= entry.boostFrom && attack.boostIcons <= entry.boostTo,
    )!;

    expect(attack.baseAtk, defender).toBe(option.baseAtk);
    expect(attack.defenseReduction, defender).toBe(option.defenseReduction);
    expect(attack.damageDealt, defender).toBe(band.damageDealt);
    expect(attack.targetInstanceId, defender).toBe(option.targetInstanceId);
  }
});
