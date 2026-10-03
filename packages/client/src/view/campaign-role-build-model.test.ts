import { describe, expect, test } from "vitest";
import type { CampaignPendingChoice } from "@mc/engine";
import {
  GRID_GAP,
  ROLE_BUILD_START,
  backFromRoleBuild,
  confirmedRoleBuildCard,
  gridGeometryOf,
  heroLeanOf,
  isRoleBuildChoice,
  leanOfText,
  roleBuildConfirmOf,
  roleBuildOf,
  roleBuildRowsOf,
  seatRoleOf,
  selectRoleBuildCard,
  setRoleBuildFilter,
  type RoleBuildCard,
  type RoleBuildContext,
} from "./campaign-role-build-model.js";

const event = (
  id: string,
  name: string,
  aspect: RoleBuildCard["aspect"],
  cost: number | null,
  text: string,
  label = name,
): RoleBuildCard => ({ id, label, name, type: "event", aspect, cost, text });

// Real printed shapes: Uppercut (3), Relentless Assault (2), Counter-Punch (0), Chase Them Down (0, thwart + attack
// wording), Expert Defense (0, no attack or thwart), Get Behind Me! (1).
const AGGRESSION_PROTECTION: readonly RoleBuildCard[] = [
  event("01054", "Uppercut", "aggression", 3, "Hero Action (attack): Deal 5 damage to an enemy."),
  event("01053", "Relentless Assault", "aggression", 2, "Hero Action (attack): Deal 5 damage to a minion."),
  event("01077", "Counter-Punch", "protection", 0, "Response (attack): After your hero defends, deal damage"),
  event(
    "01052",
    "Chase Them Down",
    "aggression",
    0,
    "Response (thwart): After your hero attacks and defeats an enemy, remove 2 threat",
  ),
  event("03033", "Expert Defense", "protection", 0, "Hero Interrupt (defense): it gets +3 DEF."),
  event("01078", "Get Behind Me!", "protection", 1, "Hero Interrupt: cancel the treachery."),
];

// Colossus: printed ATK 2, THW 1, a Protection deck.
const colossus = (roleName: string, roleAspects: RoleBuildContext["roleAspects"]): RoleBuildContext => ({
  heroName: "Colossus",
  roleName,
  roleAspects,
  deckAspects: ["protection"],
  atk: 2,
  thw: 1,
});
// Shadowcat: printed ATK 2, THW 2, an Aggression deck.
const shadowcat = (roleName: string, roleAspects: RoleBuildContext["roleAspects"]): RoleBuildContext => ({
  heroName: "Shadowcat",
  roleName,
  roleAspects,
  deckAspects: ["aggression"],
  atk: 2,
  thw: 2,
});

describe("lean", () => {
  test("reads thwart and attack from the stats and the card text", () => {
    expect(heroLeanOf(2, 1)).toBe("attack");
    expect(heroLeanOf(1, 3)).toBe("thwart");
    expect(heroLeanOf(2, 2)).toBe("none");
    expect(heroLeanOf(null, 2)).toBe("none");
    expect(leanOfText("Hero Action (thwart): Remove 2 threat from a scheme.")).toBe("thwart");
    expect(leanOfText("Hero Action (attack): Deal 5 damage to an enemy.")).toBe("attack");
    expect(leanOfText("Response: After your hero attacks, remove 1 threat.")).toBe("both");
    expect(leanOfText("Draw 2 cards.")).toBe("none");
  });
});

describe("recommendations for Colossus (Protection deck, attack-leaning)", () => {
  test("Brawler (Aggression + Protection): access first, then the attack lean, then cost", () => {
    const view = roleBuildOf(
      AGGRESSION_PROTECTION,
      colossus("Brawler", ["aggression", "protection"]),
      ROLE_BUILD_START,
    );
    expect(view.recommended.map((card) => card.name)).toEqual([
      "Relentless Assault",
      "Chase Them Down",
      "Counter-Punch",
    ]);
    expect(view.recommended[0]!.reason).toBe(
      "Gives Colossus Aggression, which the Protection deck lacks. Attack effect suits Colossus's ATK 2 vs THW 1.",
    );
    // Chase Them Down names both thwart and attack: half the lean credit, so the cost is the second clause.
    expect(view.recommended[1]!.reason).toBe(
      "Gives Colossus Aggression, which the Protection deck lacks. Attack effect suits Colossus's ATK 2 vs THW 1.",
    );
    // A Protection card is the deck's own aspect: it strengthens rather than adds access.
    expect(view.recommended[2]!.reason).toBe(
      "Strengthens the Protection deck. Attack effect suits Colossus's ATK 2 vs THW 1.",
    );
    expect(view.rest.map((card) => card.name)).toEqual(["Expert Defense", "Get Behind Me!", "Uppercut"]);
    expect(view.rest.every((card) => !card.recommended && card.reason === null)).toBe(true);
  });

  test("Defender (Justice + Protection): the Justice card is the access, the Protection ones strengthen", () => {
    const cards = [
      event("j1", "Swinging Web Kick", "justice", 1, "Hero Action (attack): Deal 4 damage."),
      event("j2", "Lockdown", "justice", 4, "Draw 1 card."),
      ...AGGRESSION_PROTECTION.filter((card) => card.aspect === "protection"),
    ];
    const view = roleBuildOf(cards, colossus("Defender", ["justice", "protection"]), ROLE_BUILD_START);
    expect(view.recommended[0]!.name).toBe("Swinging Web Kick");
    expect(view.recommended[0]!.reason).toBe(
      "Gives Colossus Justice, which the Protection deck lacks. Attack effect suits Colossus's ATK 2 vs THW 1.",
    );
    expect(view.recommended.map((card) => card.name)).toEqual(["Swinging Web Kick", "Counter-Punch", "Expert Defense"]);
    // Lockdown (a new aspect, cost 4) ties Expert Defense (own aspect, free) at 3 and loses on cost.
    expect(view.recommended[2]!.reason).toBe("Strengthens the Protection deck. Free to play.");
  });
});

describe("recommendations for Shadowcat (Aggression deck, no lean)", () => {
  test("Peacekeeper (Justice + Leadership): both aspects are new, so cost decides", () => {
    const cards = [
      event("l1", "Strategic Planning", "leadership", 3, "Draw 3 cards."),
      event("l2", "Rapid Response", "leadership", 1, "Remove 2 threat from a scheme."),
      event("j1", "Backflip", "justice", 0, "Hero Interrupt: cancel the attack."),
      event("j2", "Preemptive Strike", "justice", 4, "Hero Action (attack): Deal 6 damage."),
    ];
    const view = roleBuildOf(cards, shadowcat("Peacekeeper", ["justice", "leadership"]), ROLE_BUILD_START);
    expect(view.recommended.map((card) => card.name)).toEqual(["Backflip", "Rapid Response", "Strategic Planning"]);
    expect(view.recommended[0]!.reason).toBe("Gives Shadowcat Justice, which the Aggression deck lacks. Free to play.");
    expect(view.recommended[1]!.reason).toBe(
      "Gives Shadowcat Leadership, which the Aggression deck lacks. Cheap: costs 1.",
    );
    // ATK equals THW: no lean clause ever appears.
    expect(view.recommended.every((card) => !card.reason!.includes("suits"))).toBe(true);
    expect(view.rest.map((card) => card.name)).toEqual(["Preemptive Strike"]);
  });

  test("Brawler (Aggression + Protection): her own Aggression strengthens, Protection is new access", () => {
    const view = roleBuildOf(
      AGGRESSION_PROTECTION,
      shadowcat("Brawler", ["aggression", "protection"]),
      ROLE_BUILD_START,
    );
    expect(view.recommended.map((card) => card.name)).toEqual(["Counter-Punch", "Expert Defense", "Get Behind Me!"]);
    expect(view.recommended[0]!.reason).toBe(
      "Gives Shadowcat Protection, which the Aggression deck lacks. Free to play.",
    );
    const uppercut = view.rest.find((card) => card.name === "Uppercut")!;
    expect(uppercut.recommended).toBe(false);
  });
});

describe("recommendation details", () => {
  test("one recommendation per printed name; the other printing stays in the list", () => {
    const cards = [
      event("a", "Toe to Toe", "aggression", 0, "Hero Action (attack): Deal 3 damage.", "Toe to Toe · Core Set"),
      event("b", "Toe to Toe", "aggression", 0, "Hero Action (attack): Deal 3 damage.", "Toe to Toe · Hulk"),
      event("c", "Haymaker", "aggression", 3, "Hero Action (attack): Deal 4 damage."),
    ];
    const view = roleBuildOf(cards, colossus("Brawler", ["aggression", "protection"]), ROLE_BUILD_START);
    expect(view.recommended.map((card) => card.label)).toEqual(["Toe to Toe · Core Set", "Haymaker"]);
    expect(view.rest.map((card) => card.label)).toEqual(["Toe to Toe · Hulk"]);
  });

  test("ties break by lower cost, then name, so the order is stable", () => {
    const cards = [
      event("z", "Zeta", "leadership", 3, "Draw."),
      event("y", "Alpha", "leadership", 3, "Draw."),
      event("x", "Beta", "leadership", 3, "Draw."),
      event("w", "Gamma", "leadership", 3, "Draw."),
    ];
    const view = roleBuildOf(cards, shadowcat("Commander", ["aggression", "leadership"]), ROLE_BUILD_START);
    expect(view.recommended.map((card) => card.name)).toEqual(["Alpha", "Beta", "Gamma"]);
    expect(view.rest.map((card) => card.name)).toEqual(["Zeta"]);
  });

  test("a filter chip narrows the list but never changes which cards are recommended", () => {
    const ctx = colossus("Brawler", ["aggression", "protection"]);
    const all = roleBuildOf(AGGRESSION_PROTECTION, ctx, ROLE_BUILD_START);
    const state = setRoleBuildFilter(ROLE_BUILD_START, "protection");
    const filtered = roleBuildOf(AGGRESSION_PROTECTION, ctx, state);
    expect(filtered.recommended.map((card) => card.name)).toEqual(["Counter-Punch"]);
    expect(filtered.rest.every((card) => card.aspect.aspect === "protection")).toBe(true);
    expect(filtered.chips.map((chip) => [chip.label, chip.count, chip.selected])).toEqual([
      ["All", 6, false],
      ["Aggression", 3, false],
      ["Protection", 3, true],
    ]);
    expect(filtered.all).toHaveLength(all.all.length);
    expect(setRoleBuildFilter(state, "protection").aspect).toBeNull();
  });
});

describe("confirm step", () => {
  const view = roleBuildOf(AGGRESSION_PROTECTION, colossus("Brawler", ["aggression", "protection"]), ROLE_BUILD_START);

  test("a pick only opens the confirm; Back keeps the filter; Confirm answers the chosen id", () => {
    const filtered = setRoleBuildFilter(ROLE_BUILD_START, "aggression");
    const opened = selectRoleBuildCard(filtered, view, "01054");
    expect(opened).toEqual({ aspect: "aggression", selected: "01054" });
    expect(confirmedRoleBuildCard(opened, view)).toBe("01054");
    expect(backFromRoleBuild(opened)).toEqual({ aspect: "aggression", selected: null });
    expect(confirmedRoleBuildCard(backFromRoleBuild(opened), view)).toBeNull();
    expect(selectRoleBuildCard(ROLE_BUILD_START, view, "not-offered")).toBe(ROLE_BUILD_START);
  });

  test("the confirm question names the card and the hero", () => {
    const card = view.all.find((candidate) => candidate.name === "Uppercut")!;
    const confirm = roleBuildConfirmOf(card, "Colossus", "event");
    expect(confirm.title).toBe("Add Uppercut to Colossus's deck?");
    expect(confirm.detail).toContain("this game only");
  });
});

describe("detection", () => {
  const pending = (options: string[], optional = true): CampaignPendingChoice => ({
    instructionId: "mc32.s1.setup.role-building",
    slot: "roleEvent",
    seatNumber: 1,
    text: "Each player may role-build to modify their deck (see page 5).",
    citation: "MC32 p. 5",
    chooser: "eachSeat",
    options,
    count: 1,
    optional,
  });
  const cardOf = (id: string): { type: string; aspect: string } | undefined =>
    AGGRESSION_PROTECTION.find((card) => card.id === id) ??
    (id === "ally" ? { type: "ally", aspect: "aggression" } : undefined);
  const brawler = { aspects: ["aggression", "protection"] };

  test("an optional per-seat pick of events within the role's aspects", () => {
    expect(isRoleBuildChoice(pending(["01054", "01077"]), brawler, cardOf)).toBe(true);
    expect(isRoleBuildChoice(pending(["01054"], false), brawler, cardOf)).toBe(false);
    expect(isRoleBuildChoice(pending(["01054", "ally"]), brawler, cardOf)).toBe(false);
    expect(isRoleBuildChoice(pending(["01054"]), { aspects: ["justice", "leadership"] }, cardOf)).toBe(false);
    expect(isRoleBuildChoice(pending(["01054"]), null, cardOf)).toBe(false);
    expect(isRoleBuildChoice({ ...pending(["01054"]), seatNumber: null }, brawler, cardOf)).toBe(false);
  });

  test("a seat's role is read from its log field", () => {
    const roles = [{ id: "brawler", name: "Brawler", aspects: ["aggression", "protection"] }] as never;
    expect(seatRoleOf({ fields: { role: { kind: "choice", option: "brawler" } } }, roles)?.name).toBe("Brawler");
    expect(seatRoleOf({ fields: {} }, roles)).toBeNull();
    expect(seatRoleOf(undefined, roles)).toBeNull();
    // A role answered a moment ago is only in the answers, not yet in the seat's fields.
    const answers = [
      { seatNumber: 2, picked: ["brawler"] },
      { seatNumber: 1, picked: ["not-a-role"] },
    ];
    expect(seatRoleOf({ seatNumber: 2, fields: {} }, roles, answers)?.name).toBe("Brawler");
    expect(seatRoleOf({ seatNumber: 1, fields: {} }, roles, answers)).toBeNull();
  });
});

describe("layout", () => {
  test("a 390 px phone gets 3 columns, a desktop column up to 6", () => {
    expect(gridGeometryOf(366).columns).toBe(3);
    expect(gridGeometryOf(366).cellWidth * 3 + GRID_GAP * 2).toBeLessThanOrEqual(366);
    expect(gridGeometryOf(760).columns).toBe(6);
    expect(gridGeometryOf(1200).columns).toBe(6);
  });

  test("recommended rows come first under their own label, then the grid in rows of the column count", () => {
    const view = roleBuildOf(
      AGGRESSION_PROTECTION,
      colossus("Brawler", ["aggression", "protection"]),
      ROLE_BUILD_START,
    );
    const { rows, heights } = roleBuildRowsOf(view, 366);
    expect(rows.map((row) => row.kind)).toEqual([
      "label",
      "recommended",
      "recommended",
      "recommended",
      "label",
      "grid",
    ]);
    expect(heights).toHaveLength(rows.length);
    const grid = rows[5]!;
    expect(grid.kind === "grid" && grid.cards.length).toBe(3);
  });
});
