import { describe, expect, test } from "vitest";
import { LocalEngineHost } from "../engine/local-host.js";
import { POOL_DEPS } from "../content/pool.js";
import { idleTriggerNotes, unofferedReason } from "../view/ability-refusal.js";
import { logLine } from "../view/log-lines.js";
import { unofferedNoticesOf } from "../view/option-notice.js";
import { ANEKA, IRON_LAD, playAllyAttack, playIronLadAttack } from "./dev-iron-lad-game.js";
import { SessionStore } from "./session-store.js";

describe("the Iron Lad dev game (#431)", () => {
  test("Iron Lad attacks alone: his interrupt is not offered, and the notice and the log say why", async () => {
    const store = new SessionStore(new LocalEngineHost());
    const events = (await playIronLadAttack(store))!;
    const game = store.state.game!;
    const lad = Object.values(game.instances).find((i) => i.cardId === IRON_LAD)!.instanceId;
    const notOffered = events.filter((e) => e.type === "abilityNotOffered");
    expect(notOffered).toEqual([expect.objectContaining({ instanceId: lad, reason: "cannotPay" })]);

    expect(unofferedNoticesOf(events, game, null, POOL_DEPS)).toEqual([
      {
        key: `${lad}:56052.iron-lad-interrupt`,
        notice: {
          title: "Iron Lad: interrupt not offered",
          lead: "It answers what just happened, but it cannot be used right now, so you were not asked.",
          rows: [
            {
              kind: "unavailable",
              label: "Iron Lad's interrupt",
              why: "you control no other ready Avenger ally",
            },
          ],
        },
      },
    ]);
    // Another seat's card is not this viewer's notice.
    expect(unofferedNoticesOf(events, game, "p9" as never, POOL_DEPS)).toEqual([]);

    const line = logLine(notOffered[0]!, game, game.players[0]!.playerId, POOL_DEPS);
    expect(line?.text).toBe("Iron Lad's interrupt was not offered: you control no other ready Avenger ally.");

    // Inspect's "Right now" says it before anything triggers it, and the other cards say nothing.
    expect(idleTriggerNotes(game, lad, POOL_DEPS)).toEqual([
      "Interrupt can't be used right now: you control no other ready Avenger ally",
    ]);
    expect(idleTriggerNotes(game, game.players[0]!.identity.instanceId, POOL_DEPS)).toEqual([]);
  }, 120_000);

  test("a cost or target the wording does not know falls back to the engine's reason", () => {
    const deps = {
      ...POOL_DEPS,
      abilities: { "x.paid": { cost: { resources: { energy: 1 } }, effects: [] } },
    } as never;
    const state = { instances: {}, players: [] } as never;
    expect(unofferedReason(state, "i1" as never, "p1" as never, "x.paid" as never, "cannotPay", deps)).toBe(
      "you cannot pay its cost",
    );
    expect(unofferedReason(state, "i1" as never, "p1" as never, "x.paid" as never, "noTarget", deps)).toBe(
      "it has no valid target",
    );
  });

  test("Inspect's note is not Iron Lad's alone: any trait, a discard cost, or a 'choose an X ally' target", async () => {
    const store = new SessionStore(new LocalEngineHost());
    await playIronLadAttack(store);
    const game = store.state.game!;
    const lad = Object.values(game.instances).find((i) => i.cardId === IRON_LAD)!.instanceId;
    const real = POOL_DEPS.abilities["56052.iron-lad-interrupt" as never]!;
    const withAbility = (change: object) =>
      ({
        ...POOL_DEPS,
        abilities: { ...POOL_DEPS.abilities, "56052.iron-lad-interrupt": { ...real, ...change } },
      }) as never;
    const xMen = { categories: ["ally"], controller: "you", trait: "X-MEN" };
    const pick = (query: object) => ({ slot: "ally", query, min: 1 });
    expect(idleTriggerNotes(game, lad, withAbility({ cost: { exhaustCards: pick(xMen) } }))).toEqual([
      "Interrupt can't be used right now: you control no ready X-Men ally",
    ]);
    expect(
      idleTriggerNotes(
        game,
        lad,
        withAbility({ cost: { discardCards: pick({ categories: ["ally"], trait: "X-MEN" }) } }),
      ),
    ).toEqual(["Interrupt can't be used right now: you control no X-Men ally"]);
    const choose = { kind: "chooseTarget", slot: "ally", chooser: { kind: "controller" }, query: xMen };
    expect(idleTriggerNotes(game, lad, withAbility({ cost: undefined, effects: [choose] }))).toEqual([
      "Interrupt can't be used right now: you control no X-Men ally",
    ]);
    // Anyone's card, "another" one: a Web-Warrior ally to choose, and a Mutant one to exhaust.
    const webWarrior = { categories: ["ally"], trait: "WEB-WARRIOR", not: { self: true } };
    expect(
      idleTriggerNotes(game, lad, withAbility({ cost: undefined, effects: [{ ...choose, query: webWarrior }] })),
    ).toEqual(["Interrupt can't be used right now: there is no other Web-Warrior ally in play"]);
    const mutant = { categories: ["ally"], trait: "MUTANT" };
    expect(idleTriggerNotes(game, lad, withAbility({ cost: { exhaustCards: pick(mutant) } }))).toEqual([
      "Interrupt can't be used right now: you control no ready Mutant ally",
    ]);
    // Iron Lad is an Avenger ally himself: "choose an Avenger ally" has him, so nothing is said.
    const avenger = { ...choose, query: { ...xMen, trait: "AVENGER" } };
    expect(idleTriggerNotes(game, lad, withAbility({ cost: undefined, effects: [avenger] }))).toEqual([]);
  }, 120_000);

  test("Aneka uses a basic power with no other Dora Milaje ally: her response is not offered, and every view says why", async () => {
    const store = new SessionStore(new LocalEngineHost());
    const events = (await playAllyAttack(store, "aneka"))!;
    const game = store.state.game!;
    const aneka = Object.values(game.instances).find((i) => i.cardId === ANEKA)!.instanceId;
    const notOffered = events.filter((e) => e.type === "abilityNotOffered");
    expect(notOffered).toEqual([expect.objectContaining({ instanceId: aneka, reason: "noTarget" })]);
    const why = "there is no other Dora Milaje ally in play";
    expect(unofferedNoticesOf(events, game, null, POOL_DEPS).map(({ notice }) => notice.rows)).toEqual([
      [{ kind: "unavailable", label: "Aneka's response", why }],
    ]);
    const line = logLine(notOffered[0]!, game, game.players[0]!.playerId, POOL_DEPS);
    expect(line?.text).toBe(`Aneka's response was not offered: ${why}.`);
    expect(idleTriggerNotes(game, aneka, POOL_DEPS)).toEqual([`Response can't be used right now: ${why}`]);
  }, 120_000);
});
