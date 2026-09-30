import { trait } from "@mc/content";
import {
  chooseTarget,
  chosen,
  choosePlayer,
  chosenPlayer,
  constant,
  controllerOf,
  dealDamage,
  defineAbilities,
  discard,
  discardEncounterCards,
  each,
  exists,
  firstPlayer,
  forcedInterrupt,
  gainsIcon,
  gainsKeyword,
  gets,
  giveBoostCard,
  giveTough,
  ifThen,
  on,
  placeThreat,
  putIntoPlay,
  query,
  refMatches,
  self,
  stun,
  takeDamage,
  theMainScheme,
  whenRevealed,
} from "../../dsl/index.js";

const INHERITOR = trait("INHERITOR");
const WEB_WARRIOR = trait("WEB-WARRIOR");

/** "Each Inheritor minion" (every minion's own constant, 30031-30038). */
const INHERITOR_MINIONS = query("minion", { trait: INHERITOR });
/** "If a Web-Warrior character is in play" (every minion's own When Revealed, 30031-30038). */
const A_WEB_WARRIOR_CHARACTER_IS_IN_PLAY = exists(query("character", { trait: WEB_WARRIOR }));
/** "A character you control" (Daemos' own When Revealed, 30033). */
const A_CHARACTER_YOU_CONTROL = query("character", { controller: "you" });

/**
 * The Inheritors modular set (`spiderham` 30030-30038, docs/phase7-wave5.md): Hunting the Spider-Totems (side
 * scheme) and eight unique Inheritor minions (Bora, Brix, Daemos, Jennix, Karn, Morlun, Solus, Verna), each with a
 * set-wide "Each Inheritor minion …" constant (own copy on every card, the same shape as Secret Lair/Coordinated
 * Effort's own set-wide `gainsIcon`/`gets`/`gainsKeyword` grants, `wave4/hood/streets-of-mayhem.ts` and
 * `wave5/sm/sinister-six/guerrilla-tactics.ts`) and a "When Revealed: if a Web-Warrior character is in play, …"
 * clause gating the card's own individual effect.
 */
export const SPIDERHAM_INHERITORS = defineAbilities({
  // Hunting the Spider-Totems (30030, side scheme; startingThreat 6/0, boost icons are data) — Forced Interrupt:
  // when the villain phase begins, discard the top 3 cards of the encounter deck. Put each Inheritor minion
  // discarded this way into play engaged with a player who controls a Web-Warrior character, if able. Otherwise,
  // put each Inheritor minion discarded this way into play engaged with the first player. Same
  // `discardEncounterCards`/`forEachDiscarded`/`choosePlayer(slot, chooser, { among })` shape as Drang III's own
  // "put it into play engaged with the player who is engaged with the fewest minions" (`wave3/gmw/badoon.ts` 16060)
  // — `among: controllerOf(query(...))` is the "a player who controls a [trait] character" reading `values.ts`'s
  // own `PlayerRef controllerOf` docblock names for this exact wording, and the first player breaks a tie among
  // several qualifying players (RRG 1.8 "First Player", p. 19) the same way Drang III's fewest-minions tie does.
  // Re-checked once per discarded card, since `forEachDiscarded` resolves each card fully before the next.
  "30030.hunting-the-spider-totems-forced-interrupt": forcedInterrupt(
    on.phaseBeginning("villain"),
    discardEncounterCards(3, {
      forEachDiscarded: {
        slot: "discarded",
        effects: [
          ifThen(refMatches(chosen("discarded"), INHERITOR_MINIONS, { anywhere: true }), [
            ifThen(
              A_WEB_WARRIOR_CHARACTER_IS_IN_PLAY,
              [
                choosePlayer("engaged", firstPlayer, {
                  among: controllerOf(each(query("character", { trait: WEB_WARRIOR }))),
                }),
                putIntoPlay(chosen("discarded"), chosenPlayer("engaged")),
              ],
              putIntoPlay(chosen("discarded"), firstPlayer),
            ),
          ]),
        ],
      },
    }),
  ),

  // Bora (30031, minion; ATK 1/SCH 3/HP 5, INHERITOR, 2 boost icons are data) — Each Inheritor minion gains 1
  // acceleration icon. When Revealed: if a Web-Warrior character is in play, place 1 threat on each scheme.
  "30031.bora-constant": constant(gainsIcon("acceleration", INHERITOR_MINIONS)),
  "30031.when-revealed": whenRevealed(
    ifThen(A_WEB_WARRIOR_CHARACTER_IS_IN_PLAY, placeThreat(1, each(query("scheme")))),
  ),

  // Brix (30032, minion; ATK 2/SCH 1/HP 5, INHERITOR, 2 boost icons are data) — Each Inheritor minion gains patrol.
  // When Revealed: if a Web-Warrior character is in play, place 2 threat on the main scheme.
  "30032.brix-constant": constant(gainsKeyword({ name: "patrol" }, INHERITOR_MINIONS)),
  "30032.when-revealed": whenRevealed(ifThen(A_WEB_WARRIOR_CHARACTER_IS_IN_PLAY, placeThreat(2, theMainScheme))),

  // Daemos (30033, minion; ATK 3/SCH 1/HP 6, INHERITOR, 2 boost icons are data) — Each Inheritor minion gains
  // stalwart. When Revealed: if a Web-Warrior character is in play, stun a character you control.
  "30033.daemos-constant": constant(gainsKeyword({ name: "stalwart" }, INHERITOR_MINIONS)),
  "30033.when-revealed": whenRevealed(
    ifThen(A_WEB_WARRIOR_CHARACTER_IS_IN_PLAY, [
      chooseTarget("stunned", A_CHARACTER_YOU_CONTROL),
      stun(chosen("stunned")),
    ]),
  ),

  // Jennix (30034, minion; ATK 2/SCH 2/HP 6, INHERITOR, 2 boost icons are data) — Each Inheritor minion gains
  // guard. When Revealed: if a Web-Warrior character is in play, give Jennix a tough status card.
  "30034.jennix-constant": constant(gainsKeyword({ name: "guard" }, INHERITOR_MINIONS)),
  "30034.when-revealed": whenRevealed(ifThen(A_WEB_WARRIOR_CHARACTER_IS_IN_PLAY, giveTough(self))),

  // Karn (30035, minion; ATK 3/SCH 1/HP 5, INHERITOR, 2 boost icons are data) — Each Inheritor minion's attacks
  // gain overkill and piercing. When Revealed: if a Web-Warrior character is in play, discard an upgrade or
  // support you control. Overkill/piercing granted to the minion itself, the same reading as every other
  // "gains overkill/piercing" attack keyword grant in the corpus (`wave2/trors/taskmaster.ts` 04148,
  // `wave2/trors/crossbones.ts`), since both keywords are only ever meaningful on the attacking character.
  "30035.karn-constant": constant(
    gainsKeyword({ name: "overkill" }, INHERITOR_MINIONS),
    gainsKeyword({ name: "piercing" }, INHERITOR_MINIONS),
  ),
  "30035.when-revealed": whenRevealed(
    ifThen(A_WEB_WARRIOR_CHARACTER_IS_IN_PLAY, [
      chooseTarget("discarded", query(["upgrade", "support"], { controller: "you" })),
      discard(chosen("discarded")),
    ]),
  ),

  // Morlun (30036, minion; ATK 2/SCH 2/HP 5, ELITE/INHERITOR, 2 boost icons are data) — Each Inheritor minion gets
  // +1 ATK. When Revealed: if a Web-Warrior character is in play, take 2 damage. "Take X damage" (not "indirect
  // damage") is the player taking damage directly (`dsl/effects.ts`'s own `takeDamage`, the revealing player by
  // default).
  "30036.morlun-constant": constant(gets("atk", 1, INHERITOR_MINIONS)),
  "30036.when-revealed": whenRevealed(ifThen(A_WEB_WARRIOR_CHARACTER_IS_IN_PLAY, takeDamage(2))),

  // Solus (30037, minion; ATK 3/SCH 2/HP 7, ELITE/INHERITOR, 3 boost icons are data) — Each Inheritor minion gains
  // villainous. When Revealed: if a Web-Warrior character is in play, give Solus 1 facedown boost card.
  "30037.solus-constant": constant(gainsKeyword({ name: "villainous" }, INHERITOR_MINIONS)),
  "30037.when-revealed": whenRevealed(ifThen(A_WEB_WARRIOR_CHARACTER_IS_IN_PLAY, giveBoostCard(self))),

  // Verna (30038, minion; ATK 1/SCH 1/HP 6, ELITE/INHERITOR, 2 boost icons are data) — Each Inheritor minion gains
  // retaliate 1. When Revealed: if a Web-Warrior character is in play, deal 1 damage to each character you control.
  "30038.verna-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, INHERITOR_MINIONS)),
  "30038.when-revealed": whenRevealed(
    ifThen(A_WEB_WARRIOR_CHARACTER_IS_IN_PLAY, dealDamage(1, each(A_CHARACTER_YOU_CONTROL))),
  ),
});
