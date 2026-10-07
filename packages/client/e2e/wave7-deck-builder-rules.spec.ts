import { expect, test, type Page } from "@playwright/test";
import { activeScenes, settle } from "./helpers.js";
import {
  PHONE,
  add,
  deckPanel,
  fillPoolDeck,
  legalityLine,
  openDecks,
  poolIds,
  press,
  remove,
  search,
  shot,
  startNewDeck,
  stopOf,
  tapText,
  texts,
} from "./wave7-deck-builder-helpers.js";

/**
 * Wave 7 deck builder QA, part 2 (docs/phase7-wave7-qa-deck-builder.md): illegal states and their messages (flow 4),
 * the six new heroes' special starts (flow 5) and collection search / Inspect (flow 6), all through the real screens.
 * Expected behavior is `validateDeck` (`packages/cards/src/wave7/custom-decks.test.ts`) against RRG 1.8 Appendix I
 * "Deck Customization" (p. 50), "Permanent" (p. 32), "Linked" (p. 27), "Campaign-Specific Card" (p. 11).
 * Set MC_QA_PHONE=1 to run on a 390 x 844 touch viewport.
 */
if (PHONE) test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

const NO_MATCH = "No cards match this filter.";
const idsFor = async (page: Page, query: string): Promise<string[]> => search(page, query);

test.describe("Flow 4: illegal states and their messages (Deadpool, 'Pool)", () => {
  test("identity cards, deck size 39 / 40 / 51, and cards that must not be findable", async ({ page }) => {
    test.setTimeout(500_000);
    await openDecks(page);
    await startNewDeck(page, "44001a");
    await press(page, "DeckBuilder", "aspect:pool");

    // Removing an identity card is allowed by the controls and flagged by the validator (RRG p. 50: exact quantities).
    await search(page, "Yoo-Hoo");
    await remove(page, "44006");
    expect(await legalityLine(page)).toContain(
      '"Yoo-Hoo!" has 1 copy, but Deadpool (Wade Wilson)\'s identity set has exactly 2 copies, and a deck must include exactly that many.',
    );
    await shot(page, "4-identity-card-removed");
    await add(page, "44006");
    await search(page, "Montage");
    await remove(page, "44007");
    expect(await legalityLine(page)).toContain(
      "Montage is missing: a deck for Deadpool (Wade Wilson) must include every card in that identity's set, and this one needs 1 copy.",
    );
    await add(page, "44007");

    // Cards that are never deck cards are not findable at all: another hero's kit, campaign cards, the Dreadpool set.
    for (const [query, why] of [
      ["Mind Scan", "Cable's kit card"],
      ["Adaptive Plumage", "Angel's kit card"],
      ["Assemble the Team", "NeXt Evolution campaign card (outside campaign mode)"],
      ["Safehouse", "NeXt Evolution campaign support"],
      ["Pouches", "NeXt Evolution campaign resource"],
      ["Dreadpool", "Dreadpool set minion"],
      ["Crisis of Infinite", "Dreadpool set treachery"],
      ["Pool-ized", "Dreadpool set attachment"],
      ["Butler", "Deadpool encounter minion"],
    ] as const) {
      expect(await idsFor(page, query), `${query}: ${why}`).toEqual([]);
    }
    expect(await texts(page, "DeckBuilder")).toContain(NO_MATCH);
    await search(page, "");

    // Fill to 40, then 51, then 39.
    await fillPoolDeck(page);
    expect(await legalityLine(page)).toBe("Legal — 40 cards.");
    for (const [query, id, copies] of [
      ["Distraction", "44054", 3],
      ["Bazooka", "44052", 2],
      ["Deadpool Corps Ship", "44049", 1],
      ["Plot Convenience", "44050", 1],
      ["Self Confidence", "44025", 1],
      ["Self Control", "44026", 1],
      ["Self Preservation", "44027", 1],
      ["Git Gud", "44028", 1],
    ] as const) {
      await search(page, query);
      for (let i = 0; i < copies; i++) await add(page, id);
    }
    expect(await legalityLine(page)).toBe(
      "1 problem: The deck has 51 cards; a deck must have between 40 and 50 (the identity and permanent cards do not count).",
    );
    await shot(page, "4-over-50");
    await search(page, "Git Gud");
    await remove(page, "44028");
    expect(await legalityLine(page)).toBe("Legal — 50 cards.");
    for (const [query, id] of [
      ["Distraction", "44054"],
      ["Distraction", "44054"],
      ["Distraction", "44054"],
      ["Bazooka", "44052"],
      ["Bazooka", "44052"],
      ["Deadpool Corps Ship", "44049"],
      ["Plot Convenience", "44050"],
      ["Self Confidence", "44025"],
      ["Self Control", "44026"],
      ["Self Preservation", "44027"],
    ] as const) {
      await search(page, query);
      await remove(page, id);
    }
    expect(await legalityLine(page)).toBe("Legal — 40 cards.");
    await search(page, "Dogpool");
    await remove(page, "44013");
    expect(await legalityLine(page)).toBe(
      "1 problem: The deck has 39 cards; a deck must have between 40 and 50 (the identity and permanent cards do not count).",
    );
    await shot(page, "4-under-40");

    // Clear drops every added card back to the 15-card identity set (the aspect stays).
    await search(page, "");
    await press(page, "DeckBuilder", "clear");
    expect(await legalityLine(page)).toContain("The deck has 15 cards");
    expect(await texts(page, "DeckBuilder")).toContain("HERO · 15");
  });

  test("X-23's Linked Specialist is refused by the validator's message once added", async ({ page }) => {
    test.setTimeout(200_000);
    await openDecks(page);
    await startNewDeck(page, "43001a");
    await press(page, "DeckBuilder", "aspect:aggression");
    await search(page, "Combat Specialist");
    await add(page, "43034");
    expect(await legalityLine(page)).toContain(
      "Combat Specialist has the Linked keyword: linked cards cannot be included in a deck; they are set aside at setup by the card that brings them into play.",
    );
    await shot(page, "4-linked-specialist");
  });

  // DEFECT (rough): X-23's four Linked Specialist upgrades (43034-43037, aspect basic, "Linked (Specialized Training)")
  // are offered in the pool list and can be added; only the legality line then refuses them. RRG p. 27 "Linked": they
  // "cannot be included in any deck", and validateDeck refuses them (linked_card), but the pool list already hides the
  // other never-a-deck-card kinds (campaign-specific cards, separate-deck cards, the Dreadpool set). Owner:
  // packages/client/src/view/deck-builder-model.ts (browsablePool) should drop `keywords: linked` cards.
  test.fixme("a Linked Specialist is not findable in the builder", async ({ page }) => {
    await openDecks(page);
    await startNewDeck(page, "43001a");
    await press(page, "DeckBuilder", "aspect:aggression");
    expect(await idsFor(page, "Specialist")).toEqual([]);
  });
});

test.describe("Flow 5: the wave 7 heroes' special starts", () => {
  test("Psylocke: Psi-Knives are Permanent and the validator does not count them toward 40-50", async ({ page }) => {
    test.setTimeout(300_000);
    await openDecks(page);
    await startNewDeck(page, "41001a");
    expect(await texts(page, "DeckBuilder")).toEqual(expect.arrayContaining(["IDENTITY — PSYLOCKE", "HERO · 17"]));
    expect(await deckPanel(page)).toEqual(expect.arrayContaining(["Psi-Knife", "2"]));
    await search(page, "Psi-Knife");
    expect(await poolIds(page)).toEqual(["41002a"]);
    expect((await texts(page, "DeckBuilder")).join("\n")).toContain("Permanent.\nPsylocke gets +1 THW.");
    await shot(page, "5-psylocke");
    // Her precon: 42 listed cards, 40 counted (RRG p. 32 "Permanent"); one fewer card is 39 counted, not 41.
    await press(page, "DeckBuilder", "preconstructed");
    expect(await legalityLine(page)).toMatch(/^Legal — \d+ cards\.$/);
    await search(page, "Lay the Trap");
    await remove(page, "41016");
    expect(await legalityLine(page)).toBe(
      "1 problem: The deck has 39 cards; a deck must have between 40 and 50 (the identity and permanent cards do not count).",
    );
    await add(page, "41016");
    expect(await legalityLine(page)).toMatch(/^Legal — /);
    // Removing one of the two Psi-Knives breaks the identity set.
    await search(page, "Psi-Knife");
    await remove(page, "41002a");
    expect(await legalityLine(page)).toBe(
      "1 problem: Psi-Knife has 1 copy, but Psylocke (Betsy Braddock)'s identity set has exactly 2 copies, and a deck must include exactly that many.",
    );
  });

  // DEFECT (wrong information, rough): Psylocke's precon is 42 listed cards of which the two Permanent Psi-Knives do not
  // count (RRG p. 32), so 40 count. The legal line reads "Legal — 42 cards." while a problem line for the same deck says
  // "The deck has 39 cards" for 41 listed, two different counts for one deck, and "Your deck" does not mark the Psi-Knives
  // as Permanent or split them out ("N cards + M permanent", as campaign mode splits "N cards + M pinned").
  // Owner: packages/client/src/scenes/deck-builder.ts (#drawLegalityLine's cardCountText) and view/deck-stats.ts.
  test.fixme("the builder's count for Psylocke's precon is the counted 40 (not the 42 listed)", async ({ page }) => {
    await openDecks(page);
    await startNewDeck(page, "41001a");
    await press(page, "DeckBuilder", "preconstructed");
    expect(await legalityLine(page)).toMatch(/^Legal — 40 cards( \+ 2 permanent)?\.$/);
  });

  test("Angel: the three-face identity opens the builder with his 15-card set", async ({ page }) => {
    test.setTimeout(200_000);
    await openDecks(page);
    await startNewDeck(page, "42001a");
    expect(await texts(page, "DeckBuilder")).toEqual(expect.arrayContaining(["IDENTITY — ANGEL", "HERO · 15"]));
    expect(await deckPanel(page)).toEqual(expect.arrayContaining(["Adaptive Plumage", "Metamorphosis", "Psylocke"]));
    await press(page, "DeckBuilder", "aspect:protection");
    expect(await legalityLine(page)).toContain("a deck must have between 40 and 50");
    await shot(page, "5-angel");
  });

  test("X-23: Permanent claws and Specialized Training are in the pool; the set is 16 cards", async ({ page }) => {
    test.setTimeout(250_000);
    await openDecks(page);
    await startNewDeck(page, "43001a");
    expect(await texts(page, "DeckBuilder")).toContain("HERO · 16");
    await press(page, "DeckBuilder", "aspect:aggression");
    await search(page, "Claws");
    expect(await poolIds(page)).toEqual(["43002"]);
    expect((await texts(page, "DeckBuilder")).join("\n")).toContain("Permanent.");
    expect(await idsFor(page, "Specialized Training")).toEqual(["43021"]);
    await add(page, "43021");
    expect(await legalityLine(page)).not.toMatch(/Specialized Training/);
    await shot(page, "5-x23");
  });

  test("Cable: Technovirus Purge is in his set and a basic player side scheme is offered", async ({ page }) => {
    test.setTimeout(250_000);
    await openDecks(page);
    await startNewDeck(page, "40001a");
    expect(await texts(page, "DeckBuilder")).toContain("HERO · 15");
    await press(page, "DeckBuilder", "aspect:leadership");
    expect(await idsFor(page, "Technovirus")).toEqual(["40006"]);
    expect(await idsFor(page, "Build Support")).toEqual(["40027"]);
    expect(await idsFor(page, "Critical Hit"), "an off-aspect event is not offered").toEqual([]);
  });

  // DEFECT (blocks a legal build): Cable's identity text lets a deck include player side schemes from any aspect (RRG p. 50;
  // identity `deckbuilding.offAspectAllowance`, validated in custom-decks.test.ts "player side schemes from any aspect"),
  // but the pool list only ever offers basic, chosen-aspect and own-set cards, so a Leadership Cable cannot add Lock and
  // Load (Aggression, 40019), Establish Perimeter (Protection, 40020), Take Out the Guards (Justice, 40054), Lay the Trap
  // (Justice, 41016), Render Medical Aid (Protection, 42017) or Live Dangerously ('Pool, 44024). Only the Preconstructed
  // button (his precon holds two) can put them in. The rule must stay Cable's alone and cover side schemes only.
  // Owner: packages/client/src/view/deck-builder-model.ts (browsablePool ignores deckbuilding.offAspectAllowance).
  test.fixme("Cable can add an off-aspect player side scheme, and only those", async ({ page }) => {
    await openDecks(page);
    await startNewDeck(page, "40001a");
    await press(page, "DeckBuilder", "aspect:leadership");
    for (const [query, id] of [
      ["Lock and Load", "40019"],
      ["Establish Perimeter", "40020"],
      ["Live Dangerously", "44024"],
    ] as const) {
      expect(await idsFor(page, query)).toEqual([id]);
      await add(page, id);
    }
    expect(await legalityLine(page)).not.toMatch(/aspect is Leadership/);
    expect(await idsFor(page, "Critical Hit"), "an off-aspect event stays refused").toEqual([]);
  });

  test("Domino's start is her own 15 cards and no off-aspect allowance (Cable's rule is Cable's alone)", async ({
    page,
  }) => {
    test.setTimeout(250_000);
    await openDecks(page);
    await startNewDeck(page, "40037a");
    expect(await texts(page, "DeckBuilder")).toContain("HERO · 15");
    await press(page, "DeckBuilder", "aspect:justice");
    expect(await idsFor(page, "Lock and Load"), "Aggression side scheme").toEqual([]);
  });
});

test.describe("Flow 6: collection search and Inspect in the builder", () => {
  test("pack and wave filters, the 'Pool aspect chip, and Inspect on a per player cost card", async ({ page }) => {
    test.setTimeout(300_000);
    await openDecks(page);
    await startNewDeck(page, "44001a");
    await press(page, "DeckBuilder", "aspect:pool");
    const builder = await texts(page, "DeckBuilder");
    expect(builder).toEqual(expect.arrayContaining(["'POOL", "ALL PACKS", "ALL WAVES", "SORT: NAME"]));

    // Pack stepper: "<" from ALL PACKS wraps to the newest pack, and every card then listed is from it.
    await tapText(page, "DeckBuilder", "<");
    const packLabel = (await texts(page, "DeckBuilder")).find((t, i, all) => all[i - 1] === "<" && all[i + 1] === ">");
    expect(packLabel, "the pack stepper shows a pack name").toBeTruthy();
    expect(packLabel).not.toBe("ALL PACKS");
    const inPack = await poolIds(page);
    expect(inPack.length).toBeGreaterThan(0);
    await shot(page, "6-pack-filter");
    await tapText(page, "DeckBuilder", ">");
    expect((await texts(page, "DeckBuilder")).some((t) => t === "ALL PACKS")).toBe(true);

    // Sort steps through name, cost, pack.
    await tapText(page, "DeckBuilder", "SORT: NAME");
    expect(await texts(page, "DeckBuilder")).toContain("SORT: COST");

    // Inspect: a tap on the row's text (not the -/+) opens the card; Break Time prints 3 per player.
    await search(page, "Break Time");
    const row = (await stopOf(page, "DeckBuilder", "card:44046"))!.rect;
    await page.mouse.click(row.x + 200, row.y + 40);
    await settle(page);
    expect(await activeScenes(page)).toContain("InspectOverlay");
    const inspect = (await texts(page, "InspectOverlay")).join("\n");
    expect(inspect).toMatch(/3 PER\s*PLAYER/i);
    expect(inspect).toMatch(/BREAK TIME/i);
    await shot(page, "6-inspect-break-time");
    await page.keyboard.press("Escape");
    await settle(page);
    expect(await activeScenes(page)).not.toContain("InspectOverlay");
  });

  // DEFECT (missing feature, rough): the only text search is "card name" (a name substring). There is no trait search or
  // cost filter control in the builder (PoolFilter has `trait` and `maxCost`, view/deck-builder-model.ts, but nothing in
  // scenes/deck-builder.ts sets them), and no search by trait on the Decks screen's Card pool pane. After the split,
  // S.H.I.E.L.D. and SOLDIER are separate traits (War Machine 01030: S.H.I.E.L.D. + SOLDIER; Agent 13 27046: S.H.I.E.L.D. +
  // SPY), so searching "S.H.I.E.L.D." finds no Agent Coulson (08011), "Soldier" finds nothing. Owner:
  // packages/client/src/scenes/deck-builder.ts (#drawFilterInput) and view/deck-builder-model.ts (matchesFilter).
  test.fixme("a trait search finds cards with that trait", async ({ page }) => {
    await openDecks(page);
    await startNewDeck(page, "01001a");
    await press(page, "DeckBuilder", "aspect:justice");
    expect(await idsFor(page, "S.H.I.E.L.D.")).toContain("08011");
  });
});
