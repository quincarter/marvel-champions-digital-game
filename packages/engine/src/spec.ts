import type { Trait } from "@mc/content";
/** When a lasting effect ends: "until the end of the phase" / "…of the round" / "…of this attack". */
export type LastingUntil = "endOfPhase" | "endOfRound" | "endOfAttack";
import type { PlayerId } from "./ids.js";
import type { ResourceRequirement, TypedResource } from "./resources.js";
import type { FacedownRole, Form, GameStep } from "./state.js";

/**
 * The executable effect vocabulary. The Phase 2 ability DSL compiles down to
 * these; the stack knows how to run them and nothing else. Everything here is
 * plain JSON so an ability definition can be inspected, logged, and replayed.
 */

/** Card categories a target query can filter on. Broader than `AnyCard["type"]` on purpose. */
export type TargetCategory =
  | "character"
  | "enemy"
  | "villain"
  | "minion"
  | "ally"
  | "hero"
  | "alterEgo"
  | "identity"
  | "scheme"
  | "mainScheme"
  | "sideScheme"
  | "upgrade"
  | "support"
  | "attachment"
  | "event"
  | "resource"
  | "treachery"
  | "obligation"
  | "environment";

/** A data filter over card instances. `chooseTarget` and constant modifiers both use it. */
export interface TargetQuery {
  readonly categories?: readonly TargetCategory[];
  /** "you" = the ability's controller, "other" = any other player, "encounter" = no controller. */
  readonly controller?: "you" | "other" | "any" | "encounter";
  readonly engagedWith?: "you" | "any";
  readonly trait?: Trait;
  /** Exact printed card name ("the Breakin' & Takin' side scheme", "the Ultron Drones environment"). */
  readonly name?: string;
  /** The card this card is attached to (true) or anything else (false): "When attached minion is defeated". */
  readonly hostOfSelf?: boolean;
  /** In play facedown as something else ("each facedown Drone minion"). */
  readonly facedown?: boolean;
  /** Cards with at least one printed icon of this resource type ("each card with a printed [mental] resource"). Wild is its own type. */
  readonly printedResource?: "physical" | "mental" | "energy" | "wild";
  /** The card's owner is the ability's controller ("your discard pile" cards, "cards you own"). */
  readonly owner?: "you";
  /** Player-card aspect, e.g. "aggression" ("while paying for an Aggression card"). */
  readonly aspect?: string;
  readonly exhausted?: boolean;
  readonly hasThreat?: boolean;
  readonly damaged?: boolean;
  readonly hasStatus?: "stunned" | "confused" | "tough";
  /** Restrict to (or exclude) the ability's own card. */
  readonly self?: boolean;
  readonly maxPrintedHp?: number;
  /** Only enemies this character is allowed to attack right now (RRG "Guard"). */
  readonly attackableBy?: TargetRef;
  /** Excludes cards already bound to these slots: "remove 2 threat from a *different* scheme". */
  readonly excludeSlots?: readonly string[];
  /** Controlled by one of these players: "each character *that player* controls" (a chosen player). */
  readonly controlledBy?: PlayerRef;
  /** Engaged with one of these players: "each enemy engaged with *that player*". */
  readonly engagedWithPlayer?: PlayerRef;
}

/** Names one instance without knowing its id at authoring time. */
export type TargetRef =
  | { readonly kind: "self" }
  /** The card this card is attached to ("attached minion", "that enemy" on Webbed Up). */
  | { readonly kind: "host" }
  /** Every card in play matching the query: "each enemy", "each friendly character", "each hero". */
  | { readonly kind: "each"; readonly query: TargetQuery }
  /** The card in play with this exact printed name ("Bomb Scare", "the Legions of Hydra side scheme"). */
  | { readonly kind: "named"; readonly name: string }
  | { readonly kind: "slot"; readonly slot: string }
  | { readonly kind: "eventSource" }
  | { readonly kind: "eventTarget" }
  | { readonly kind: "villain" }
  | { readonly kind: "mainScheme" }
  | { readonly kind: "identityOf"; readonly player: PlayerRef };

export type PlayerRef =
  | { readonly kind: "controller" }
  | { readonly kind: "eventPlayer" }
  | { readonly kind: "firstPlayer" }
  | { readonly kind: "each" }
  | { readonly kind: "id"; readonly playerId: PlayerId }
  /** The player(s) picked by `choosePlayer` into this slot ("choose a player. That player …"). */
  | { readonly kind: "slot"; readonly slot: string }
  /** "That player" inside `forEachPlayer`. */
  | { readonly kind: "scoped" }
  /** The owner of a card ("return each card to its owner's hand"). */
  | { readonly kind: "ownerOf"; readonly target: TargetRef }
  /** Every player except these: "each other hero" (Whirlwind). */
  | { readonly kind: "others"; readonly of: PlayerRef }
  /** The player a card is engaged with: "the engaged player" on a minion's own ability. */
  | { readonly kind: "engagedWith"; readonly of: TargetRef };

export type ValueSpec =
  | { readonly kind: "const"; readonly value: number }
  | { readonly kind: "perPlayer"; readonly base: number; readonly perPlayer: number }
  | { readonly kind: "stat"; readonly of: TargetRef; readonly stat: StatName }
  | { readonly kind: "counters"; readonly of: TargetRef; readonly counterType: string }
  | { readonly kind: "eventAmount" }
  /**
   * A number bound earlier in this ability: "X" from "Spend X [energy]", the
   * count of cards discarded as a cost, `paid.<type>` / `paid.total` for the
   * resources spent on the card, `self.counters.<type>` snapshotted by a
   * discard-self cost.
   */
  | { readonly kind: "var"; readonly name: string }
  /** A result of the triggering event ("for each damage dealt by this attack" → `damage`). */
  | { readonly kind: "eventResult"; readonly key: string }
  /** Arithmetic on another value: "2 damage for each counter (max 10)" → `{ value, times: 2, max: 10 }`; "X is 1 more than" → `plus: 1`. */
  | { readonly kind: "scaled"; readonly value: ValueSpec; readonly times?: number; readonly plus?: number; readonly max?: number }
  /** How many cards in play match: "for each side scheme in play", "for each Drone minion engaged with you". */
  | { readonly kind: "count"; readonly query: TargetQuery }
  /** A character's remaining hit points (max HP minus damage): "X is equal to Titania's remaining hit points". */
  | { readonly kind: "remainingHp"; readonly of: TargetRef }
  /** "N (M instead if …)": `then` when the predicate holds, `else` otherwise. */
  | { readonly kind: "conditional"; readonly if: Predicate; readonly then: ValueSpec; readonly else: ValueSpec }
  /** Damage on a card: "X is the amount of damage you have sustained" (Gamma Slam). */
  | { readonly kind: "damage"; readonly of: TargetRef }
  /** Threat on a scheme: "X is the amount of threat on Bomb Scare". */
  | { readonly kind: "threat"; readonly of: TargetRef }
  /** Boost icons printed on a card: "1 more than the number of boost icons on the discarded card" (with `scaled`). */
  | { readonly kind: "boostIcons"; readonly of: TargetRef }
  /** A player's hand size; `printed` ignores modifiers ("draw up to your printed hand size"). */
  | { readonly kind: "handSize"; readonly player: PlayerRef; readonly printed?: boolean }
  /** Cards in a player's hand. */
  | { readonly kind: "handCount"; readonly player: PlayerRef }
  /** Distinct printed resource types among cards ("for each different resource type discarded this way"). Wild counts as its own type. */
  | { readonly kind: "resourceTypes"; readonly cards: TargetRef };

export type StatName = "atk" | "thw" | "def" | "rec" | "sch";

export type Predicate =
  | { readonly kind: "form"; readonly player: PlayerRef; readonly form: Form }
  | { readonly kind: "hasStatus"; readonly of: TargetRef; readonly status: "stunned" | "confused" | "tough" }
  | { readonly kind: "exists"; readonly query: TargetQuery }
  | { readonly kind: "counterAtLeast"; readonly of: TargetRef; readonly counterType: string; readonly amount: number }
  | { readonly kind: "damagedAtLeast"; readonly of: TargetRef; readonly amount: number }
  | { readonly kind: "not"; readonly of: Predicate }
  /** "If you paid for this card using a [X] resource" (a wild can be declared as X). */
  | { readonly kind: "paidWith"; readonly resource: TypedResource }
  /** A bound number (see `ValueSpec` `var`) is at least `amount`. */
  | { readonly kind: "varAtLeast"; readonly name: string; readonly amount: number }
  | { readonly kind: "and"; readonly of: readonly Predicate[] }
  | { readonly kind: "or"; readonly of: readonly Predicate[] }
  /** A result of the triggering event is at least `amount` ("if this attack dealt damage"). */
  | { readonly kind: "eventResultAtLeast"; readonly key: string; readonly amount: number }
  /** A result of the attack/activation in progress ("if the villain is making an undefended attack" → `undefended`). */
  | { readonly kind: "currentAttack"; readonly key: string; readonly atLeast: number }
  /** "If you have the Aerial trait" — includes traits gained from abilities and lasting effects. */
  | { readonly kind: "hasTrait"; readonly of: TargetRef; readonly trait: Trait }
  /**
   * Some card the ref names is in play and matches the query: "if this activation
   * deals damage to *you*" (the event target is your identity), and the in-play
   * guard for "stun that character" after it may have been defeated.
   */
  | { readonly kind: "refMatches"; readonly ref: TargetRef; readonly query: TargetQuery }
  /** The game is at this phase (and step): "during step one of the villain phase". */
  | { readonly kind: "gameStep"; readonly phase: GameStep["phase"]; readonly step?: GameStep["kind"] };

export type StatusName = "stunned" | "confused" | "tough";

/**
 * `bind` on an event-producing effect reports what it did into this ability's
 * vars when it finishes: `<bind>.amount` (damage taken / damage healed / threat
 * placed or removed), `<bind>.made` (1 if it happened), and for attacks
 * `<bind>.damage`, `<bind>.defeated`, `<bind>.undefended`.
 */
export type EffectSpec =
  | { readonly kind: "dealDamage"; readonly target: TargetRef; readonly amount: ValueSpec; readonly fromAttack?: boolean; readonly bind?: string }
  /** "Heal N damage"; with `bind`, "if no damage was healed this way" reads `<bind>.amount`. */
  | { readonly kind: "heal"; readonly target: TargetRef; readonly amount: ValueSpec; readonly bind?: string }
  | { readonly kind: "placeThreat"; readonly target: TargetRef; readonly amount: ValueSpec; readonly bind?: string }
  | { readonly kind: "removeThreat"; readonly target: TargetRef; readonly amount: ValueSpec; readonly bind?: string }
  /**
   * "(attack)": "Deal N damage to an enemy" resolved as an attack by your
   * identity (or `attacker`): guard, retaliate, "after X attacks" and overkill
   * all apply. Pair with `label: ["attack"]` on the ability. `moveDamageFrom`
   * is "move N damage from your hero to an enemy" (capped by the damage there).
   */
  | {
      readonly kind: "attack";
      readonly target: TargetRef;
      readonly amount: ValueSpec;
      readonly attacker?: TargetRef;
      readonly overkill?: boolean;
      readonly moveDamageFrom?: TargetRef;
      readonly bind?: string;
    }
  /** "(thwart)": "Remove N threat from a scheme" resolved as a thwart by your identity (or `thwarter`). Pair with `label: ["thwart"]`. */
  | { readonly kind: "thwart"; readonly target: TargetRef; readonly amount: ValueSpec; readonly thwarter?: TargetRef; readonly bind?: string }
  /**
   * Changes the attack/activation in progress: "the attack gains overkill",
   * "give him 1 additional boost card for this activation", "+N ATK until the
   * end of this attack".
   */
  | {
      readonly kind: "modifyAttack";
      readonly overkill?: boolean;
      readonly extraBoostCards?: number;
      readonly atkBonus?: ValueSpec;
      /** Scheme activations: "reduce the amount of threat placed on the scheme by 1" (Emergency) → `-1`. */
      readonly threatBonus?: ValueSpec;
    }
  /** "At the end of this attack, …" — runs after the current attack's responses. The triggering event carries its `results`. */
  | { readonly kind: "atEndOfAttack"; readonly effects: readonly EffectSpec[] }
  /** Interrupt to damage: "prevent N of that damage" (Cosmic Flight) / "prevent all" (Backflip, `amount` absent). */
  | { readonly kind: "preventDamage"; readonly amount?: ValueSpec }
  /** Interrupt to threat being placed: "prevent 1 of that threat" (Jennifer Walters). `amount` absent = all. */
  | { readonly kind: "preventThreat"; readonly amount?: ValueSpec }
  /**
   * RRG "Replacement Effect": "…instead" — the triggering event doesn't happen
   * (no further interrupts or responses to it) and `with` resolves in its place,
   * with the original event as context (`eventAmount`, `eventTarget`, …).
   * "You take it as damage instead", "place it here instead", "heal all damage
   * from it instead".
   */
  | { readonly kind: "replaceTriggeringEvent"; readonly with: readonly EffectSpec[] }
  /** Interrupt to an encounter card being revealed: cancel only its "When Revealed" effects (incite and surge included). */
  | { readonly kind: "cancelWhenRevealed" }
  /** Interrupt to an encounter card being revealed: "cancel the effects of that card and discard it" (Black Widow). */
  | { readonly kind: "cancelRevealedCard" }
  /** "Place N damage here" — damage tokens placed without being dealt (no damage event; Armored Rhino Suit). */
  | { readonly kind: "placeDamage"; readonly target: TargetRef; readonly amount: ValueSpec }
  /** Remembers what a ref points to now under `slot`, for later effects ("that enemy" after this card is discarded). */
  | { readonly kind: "bindTargets"; readonly slot: string; readonly target: TargetRef }
  /**
   * A lasting stat change: "Until the end of the phase, Vision gets +2 ATK"
   * (`target`, fixed now) / "Each character that player controls gets +1 THW
   * until the end of the phase" (`affects`, which also catches cards that
   * enter play later — RRG "Lasting Effects") / "Until the end of his attack,
   * Ultron gets +1 ATK for each Drone" (`until: "endOfAttack"`). `amount` is
   * re-evaluated on every read in the creating ability's context.
   */
  | {
      readonly kind: "modifyStatUntil";
      readonly stat: StatName | "hp" | "handSize";
      readonly amount: ValueSpec;
      readonly target?: TargetRef;
      readonly affects?: TargetQuery;
      readonly until: LastingUntil;
    }
  /** "Gain the Aerial trait until the end of the phase" (Rocket Boots). */
  | { readonly kind: "grantTraitUntil"; readonly trait: Trait; readonly target?: TargetRef; readonly affects?: TargetQuery; readonly until: LastingUntil }
  /** A delayed effect: "At the end of the round, if Nick Fury is still in play, discard him." Fires after round-end lasting effects expire. */
  | { readonly kind: "atEndOfRound"; readonly effects: readonly EffectSpec[] }
  /**
   * Moves cards between zones (in or out of play): "discard the top 2 cards of
   * your deck" (`zone: deck, top: 2 → discard`), "add each card with a printed
   * [mental] resource to your hand", "return the topmost Tech upgrade in their
   * discard pile to their hand", "shuffle them into your deck", "return Hellcat
   * to your hand". `bind` records the moved cards in slot `bind`, their count in
   * var `<bind>.count` and their printed resource icons in `<bind>.<type>`.
   */
  | { readonly kind: "moveCards"; readonly cards: CardSelector; readonly to: CardDestination; readonly bind?: string }
  /** Choose cards outside play ("look at the top 3 … add 1", "search your deck for an upgrade", "choose up to 3 different cards in your discard"). */
  | {
      readonly kind: "chooseCards";
      readonly slot: string;
      readonly from: CardSelector;
      readonly chooser: PlayerRef;
      readonly min: number;
      readonly max: number;
      /** "different cards": no two with the same name. */
      readonly distinctNames?: boolean;
    }
  /** Shuffle a player's deck (RRG "Search": searching any part of a deck shuffles it afterwards). */
  | { readonly kind: "shuffleDeck"; readonly player: PlayerRef }
  /** "Change your form" as an effect; doesn't use the player's one voluntary change this round (RRG "Form, Change Form"). */
  | { readonly kind: "changeForm"; readonly player: PlayerRef; readonly to?: Form }
  /** "Draw up to N cards" / "draw up to your printed hand size". */
  | { readonly kind: "drawUpTo"; readonly player: PlayerRef; readonly amount: ValueSpec }
  /**
   * "Choose one: …" / "Choose to either … or …". Options whose `condition`
   * fails aren't offered; with one option left it resolves without asking.
   */
  | {
      readonly kind: "chooseOne";
      readonly chooser: PlayerRef;
      readonly options: readonly { readonly label: string; readonly condition?: Predicate; readonly effects: readonly EffectSpec[] }[];
    }
  /** "Choose a player." Binds that player (their identity) into `slot`; use `PlayerRef` `slot` to refer to them. */
  | { readonly kind: "choosePlayer"; readonly slot: string; readonly chooser: PlayerRef }
  /** "Each player …": runs `effects` once per player in player order, with `PlayerRef` `scoped` = that player. */
  | { readonly kind: "forEachPlayer"; readonly players: PlayerRef; readonly effects: readonly EffectSpec[] }
  /**
   * "Resolve the Special ability on each [Black Panther] upgrade you control in
   * any order. (Each is a step in a sequence.)" The controller orders them; each
   * step gets vars `sequence.step` and `sequence.final` (1 on the last step).
   */
  | { readonly kind: "resolveSpecials"; readonly cards: TargetQuery }
  /**
   * "Rhino attacks you" / "The villain and each minion engaged with you attacks
   * you" / "Each Masters of Evil minion attacks the hero it is engaged with" /
   * "Titania attacks your hero". Each enemy in `enemies` attacks each player in
   * `against` (absent = the player it is engaged with, else this ability's
   * player), through the full enemy-attack procedure (boost, defense, …). A
   * stunned enemy discards its stun instead and doesn't attack (RRG "Stun").
   * `bind`: `<bind>.made` (attacks made), `.damage`, `.undefended`, and slots
   * `<bind>.damaged` / `<bind>.target` ("if a character is damaged by this
   * attack, that character is stunned"). `additionalResolution` marks the same
   * attack resolved against more players (Whirlwind): the attacker's own "when
   * this enemy attacks" abilities don't trigger again for it.
   */
  | {
      readonly kind: "enemyAttack";
      readonly enemies: TargetRef;
      readonly against?: PlayerRef;
      readonly bind?: string;
      readonly additionalResolution?: boolean;
    }
  /** "The villain schemes" / "Ultron schemes": a scheme activation; a confused enemy discards its confusion instead. `bind`: `<bind>.made`, `<bind>.threatPlaced`. */
  | { readonly kind: "enemyScheme"; readonly enemies: TargetRef; readonly against?: PlayerRef; readonly bind?: string }
  /** "This card gains surge": the encounter card whose ability this is surges when its reveal finishes. */
  | { readonly kind: "gainSurge" }
  /**
   * "Either spend [E][M][P] resources or …" / "Choose to either spend a
   * [energy] resource or …": asks `player` for a payment (a `spendResources`
   * choice over their payment options). Paying at least `resources` spends it
   * and sets `<bind>.made` to 1; paying nothing (or too little) declines and
   * sets it to 0, so the alternative can follow as `if not <bind>.made`.
   */
  | { readonly kind: "spendResources"; readonly player: PlayerRef; readonly resources: ResourceRequirement; readonly bind: string }
  /**
   * "Put the top card of your deck into play facedown, engaged with you as a
   * [Drone] minion." For each player, `count` times (default 1). An empty deck
   * resets first (FFG ruling: "Put the second drone into play after reshuffling
   * your deck and dealing yourself a facedown encounter card"). When it leaves
   * play it goes to its owner's zones and is itself again.
   */
  | { readonly kind: "putIntoPlayFacedown"; readonly player: PlayerRef; readonly count?: ValueSpec; readonly as: FacedownRole }
  /** Binds the cards a selector names now into `slot` (and `<slot>.count`): "your set-aside nemesis minion", "the Breakin' & Takin' side scheme in the encounter deck or discard". */
  | { readonly kind: "selectCards"; readonly slot: string; readonly cards: CardSelector }
  /** "Reveal it": each card goes through the full reveal procedure (RRG "Reveal") for `player`, from wherever it is. */
  | { readonly kind: "revealCard"; readonly cards: TargetRef; readonly player: PlayerRef }
  | { readonly kind: "shuffleEncounterDeck" }
  /** "Discard cards from the encounter deck until a minion is discarded": the matching card is bound to `bind` (then `putIntoPlay` / `revealCard` it). */
  | { readonly kind: "discardEncounterUntil"; readonly filter: TargetQuery; readonly bind: string }
  /** "Place a random card from their hand facedown here" — tucked cards are out of play (RRG "Tuck"). */
  | { readonly kind: "tuckCards"; readonly cards: CardSelector; readonly under: TargetRef; readonly facedown?: boolean }
  /** "Assign X damage among heroes and allies": the chooser places it one point at a time; each character then takes its share as one damage event. */
  | { readonly kind: "assignDamage"; readonly amount: ValueSpec; readonly among: TargetQuery; readonly chooser: PlayerRef }
  | { readonly kind: "draw"; readonly player: PlayerRef; readonly amount: ValueSpec }
  | { readonly kind: "discardFromHand"; readonly player: PlayerRef; readonly amount: ValueSpec; readonly random?: boolean }
  /** Turns the top N encounter cards faceup without revealing them (RRG "Search"). */
  | {
      readonly kind: "revealTopOfEncounterDeck";
      readonly count: number;
      readonly then: "discard" | "returnToTop";
    }
  | { readonly kind: "exhaust"; readonly target: TargetRef }
  | { readonly kind: "ready"; readonly target: TargetRef }
  | { readonly kind: "giveStatus"; readonly target: TargetRef; readonly status: StatusName }
  | { readonly kind: "removeStatus"; readonly target: TargetRef; readonly status: StatusName }
  | { readonly kind: "addCounters"; readonly target: TargetRef; readonly counterType: string; readonly amount: ValueSpec }
  | { readonly kind: "removeCounters"; readonly target: TargetRef; readonly counterType: string; readonly amount: ValueSpec }
  | { readonly kind: "attach"; readonly card: TargetRef; readonly to: TargetRef }
  | { readonly kind: "discardFromPlay"; readonly target: TargetRef }
  | { readonly kind: "putIntoPlay"; readonly card: TargetRef; readonly controller: PlayerRef }
  | { readonly kind: "dealEncounterCard"; readonly player: PlayerRef }
  | { readonly kind: "revealEncounterCard"; readonly player: PlayerRef }
  | { readonly kind: "addAccelerationToken" }
  | { readonly kind: "removeAccelerationToken" }
  /** Parks a `chooseTarget` choice for `chooser` and binds the answer to `slot`. */
  | {
      readonly kind: "chooseTarget";
      readonly slot: string;
      readonly query: TargetQuery;
      readonly chooser: PlayerRef;
      readonly count?: number;
      readonly optional?: boolean;
    }
  | { readonly kind: "if"; readonly condition: Predicate; readonly then: readonly EffectSpec[]; readonly otherwise?: readonly EffectSpec[] }
  /** RRG "Cancel": stops the interrupted event from resolving (its responses do not fire). */
  | { readonly kind: "cancelTriggeringEvent" }
  /** "Reduce the resource cost of the next card that player plays this phase by 1" (lasting, consumed on use). */
  | {
      readonly kind: "reduceNextCardCost";
      readonly player: PlayerRef;
      readonly amount: ValueSpec;
      readonly duration: "phase" | "round";
    };

/** Which cards a `moveCards`/`chooseCards` works on. */
export type CardSelector =
  | { readonly kind: "ref"; readonly ref: TargetRef; readonly filter?: TargetQuery }
  /** The encounter deck and/or discard pile ("search the encounter deck and discard pile for …"). */
  | { readonly kind: "encounter"; readonly zones: readonly ("deck" | "discard")[]; readonly filter?: TargetQuery; readonly top?: ValueSpec }
  /** A player's set-aside nemesis set. */
  | { readonly kind: "setAside"; readonly player: PlayerRef; readonly filter?: TargetQuery }
  /** Cards tucked under a card ("each facedown card here"). */
  | { readonly kind: "tucked"; readonly under: TargetRef }
  | {
      readonly kind: "zone";
      readonly zone: "hand" | "deck" | "discard";
      readonly player: PlayerRef;
      readonly filter?: TargetQuery;
      /** Only the top N cards of the zone (deck top, most recent discards). */
      readonly top?: ValueSpec;
      /** Only the first matching card from the top ("the topmost Tech upgrade"). */
      readonly topmostOnly?: boolean;
      /** N cards chosen at random from the (filtered) zone, per player ("1 card at random from your hand"). */
      readonly random?: ValueSpec;
    };

/** Where `moveCards` puts cards. Player cards go to their owner's zones; encounter cards to the encounter discard. */
export type CardDestination = "hand" | "discard" | "deckTop" | "deckBottom" | "deckShuffle" | "removedFromGame" | "encounterDeckShuffle";
