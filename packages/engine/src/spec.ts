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
  /** Only cards already bound to this slot: a choice among candidates an earlier step narrowed (tied villains). */
  readonly inSlot?: string;
  /** Controlled by one of these players: "each character *that player* controls" (a chosen player). */
  readonly controlledBy?: PlayerRef;
  /** Engaged with one of these players: "each enemy engaged with *that player*". */
  readonly engagedWithPlayer?: PlayerRef;
  /** A villain's signature side scheme (true) or any other card (false): The Wrecking Crew insert, "Signature Side Schemes". */
  readonly signatureSideScheme?: boolean;
  /**
   * A card of this player's identity set: "a Ms. Marvel card" (Teen Spirit), "a Doctor Strange card" (Mystical
   * Studies). RRG 1.8 "Identity-Specific Card" (p. 23) — the set icon, which the card data carries as
   * `aspect: "hero:<identity card id>"`. Player cards only: the identity card itself is not a card of its own set,
   * and nemesis cards are encounter cards (ruling, Jun 25, 2026 (4): "Nemesis sets belong to that identity", which
   * is about set ownership, not about these deckbuilding filters).
   */
  readonly identitySetOf?: PlayerRef;
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
  /**
   * "The villain": the active villain (The Wrecking Crew insert, "The Active Villain": "Any card effect that refers
   * to 'the villain' only refers to the active villain."). "A villain" is `each`/`chooseTarget` over the
   * `villain` category, which matches every villain in play.
   */
  | { readonly kind: "villain" }
  | { readonly kind: "mainScheme" }
  | { readonly kind: "identityOf"; readonly player: PlayerRef }
  /** "The villain corresponding to the attached side scheme" (Held Hostage): each undefeated villain whose signature side scheme the ref names. */
  | { readonly kind: "villainOfSideScheme"; readonly scheme: TargetRef }
  /** "His side scheme" / "his corresponding side scheme" (Radioactive Buildup): each named villain's signature side scheme, while in play. */
  | { readonly kind: "signatureSideSchemeOf"; readonly villain: TargetRef }
  /** "Each card attached here" / "the cards attached to that character" (Bruno Carrelli), in attachment order. */
  | { readonly kind: "attachmentsOf"; readonly of: TargetRef; readonly filter?: TargetQuery }
  /**
   * "The X with the highest/lowest Y": the hero with the fewest hit points remaining (Mad Genius), the enemy with
   * the highest ATK (Clash of the Titans), the villain whose side scheme has the most threat (Get Wrecked!), the
   * highest printed cost among cards in hand (Burn Notice).
   *
   * `among` is the pool — `{ kind: "each", query }` for cards in play, or a slot an earlier `selectCards` bound for
   * cards out of play. `measure` is evaluated once per candidate with that candidate bound to `slot` (default
   * `"candidate"`), so any `ValueSpec` can be the measure, including one that reads another card ("the villain
   * *whose side scheme* has the most threat").
   *
   * **Ties resolve to every tied card** (`ties: "all"`, the default), because a ref is resolved without asking
   * anyone. An effect that needs exactly one must break the tie itself: bind this ref with `bindTargets`, then
   * `chooseTarget` over `{ inSlot }` — `chooser: firstPlayer` on an encounter card, which carries
   * `firstPlayerTargets` authority (RRG 1.8 "First Player", p. 19), or `chooser: controller` on a player card.
   * `ties: "first"` takes the first candidate in the pool's stable order, for a card whose text makes the choice
   * irrelevant.
   */
  | {
      readonly kind: "superlative";
      readonly among: TargetRef;
      readonly order: "highest" | "lowest";
      readonly measure: ValueSpec;
      readonly slot?: string;
      readonly ties?: "all" | "first";
    };

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
  | { readonly kind: "resourceTypes"; readonly cards: TargetRef }
  /** Distinct card types among cards ("for each different card type discarded this way": Trickster, Leading the Charge). */
  | { readonly kind: "distinctCardTypes"; readonly cards: TargetRef }
  /** A card's printed cost (RRG 1.8 "Printed", p. 35): "equal to its printed cost" (Headbutt, Thoughtcasting). A card with no printed cost is 0. */
  | { readonly kind: "printedCost"; readonly of: TargetRef }
  /**
   * A villain's printed stage number (Death from Above, Wicked Ambitions): the numeral printed on the stage card
   * (`VillainStage.stageNumber`), not its index in the deck — expert play starts on stage II, whose number is 2.
   * `of` absent is the active villain ("the villain").
   */
  | { readonly kind: "villainStageNumber"; readonly of?: TargetRef };

export type StatName = "atk" | "thw" | "def" | "rec" | "sch";

/**
 * A scheme's threat values as modifier keys (docs/phase7-wave1.md §3.8): "Increase the target threat value of attached
 * scheme by 4" (`targetThreat`), Mutagen Cloud 2B's "X is equal to the number of Goblin enemies" (`acceleration` with
 * `setBase`). Read through `mainSchemeValue` / `startingThreatOf`.
 */
export type SchemeValueName = "acceleration" | "targetThreat" | "startingThreat";

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
   *
   * `anywhere`: read the card wherever it is, in play or not — "each time a Goblin minion is discarded this way"
   * (Wicked Ambitions) asks about a card that is in a discard pile by the time the question is asked.
   */
  | { readonly kind: "refMatches"; readonly ref: TargetRef; readonly query: TargetQuery; readonly anywhere?: boolean }
  /** The game is at this phase (and step): "during step one of the villain phase". */
  | { readonly kind: "gameStep"; readonly phase: GameStep["phase"]; readonly step?: GameStep["kind"] }
  /**
   * The card is attached to something: "If you cannot, this card gains surge" (Goblin Glider) asks whether its
   * "attach to" found a host. RRG 1.8 "Attach To" (p. 8): legality is checked as the card would be attached, and a
   * card that cannot attach is discarded — its "When Revealed" still resolves, and reads this.
   */
  | { readonly kind: "isAttached"; readonly of: TargetRef }
  /**
   * The card's current face has this title: "When Revealed (Green Goblin)" resolves "only if the Green Goblin side of
   * the villain is in play" (Green Goblin insert, Risky Business "New Rules"). Reads a villain's side and a flipped
   * encounter card's other face.
   */
  | { readonly kind: "faceNamed"; readonly of: TargetRef; readonly name: string }
  /**
   * "If you paid for this card using only [physical] resources" (Hulk Smash): something was paid, and every resource was
   * that type or a wild declared as it. FAQ "Unstoppable Force (#6)" (p. 60): at a cost of 0 it fails.
   */
  | { readonly kind: "paidWithOnly"; readonly resource: TypedResource }
  /** How many cards of a type a player has played this round is at most `atMost`: "the first ally played each round" → 0. */
  | { readonly kind: "playedThisRound"; readonly player: PlayerRef; readonly cardType: string; readonly atMost: number };

export type StatusName = "stunned" | "confused" | "tough";

/**
 * `bind` on an event-producing effect reports what it did into this ability's
 * vars when it finishes: `<bind>.amount` (damage taken / damage healed / threat
 * placed or removed), `<bind>.made` (1 if it happened), and for attacks
 * `<bind>.damage`, `<bind>.defeated`, `<bind>.undefended`, `<bind>.excessDealt`
 * (damage dealt beyond remaining hit points; RRG 1.8 "Excess Damage", p. 19).
 */
export type EffectSpec =
  /**
   * `ignoreTough`: "This damage ignores tough status cards" (Lightning Strike, as errataed on RRG 1.8 p. 65). The
   * damage is taken although a tough status card is on the character, and — unlike piercing, which the RRG defines as
   * discarding it — nothing says the status card is removed, so it stays (RRG 1.8 "Tough", p. 44: a tough card
   * "prevents a character from taking damage"; "Piercing" is the keyword that discards it). Engine reading, flagged
   * in docs/phase7-wave1.md §3.13.
   */
  | {
      readonly kind: "dealDamage";
      readonly target: TargetRef;
      readonly amount: ValueSpec;
      readonly fromAttack?: boolean;
      readonly ignoreTough?: boolean;
      readonly bind?: string;
    }
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
  /** "After this activation ends, shuffle this card into the encounter deck" (Goblin Knight's boost): `atEndOfAttack`'s timing, for an attack or a scheme. */
  | { readonly kind: "atEndOfActivation"; readonly effects: readonly EffectSpec[] }
  /**
   * "Cancel the boost icons on that card" (Attacrobatics, Preemptive Strike, Foiled!): the boost card the current
   * activation is resolving. A card with no icons has nothing to cancel (FAQ "Attacrobatics (#6)", p. 59). `bind`:
   * `<bind>.made`, `<bind>.amount` (icons cancelled: "Deal 1 damage … for each boost icon canceled this way").
   */
  | { readonly kind: "cancelBoostIcons"; readonly bind?: string }
  /** "Cancel that card's boost ability" (Target Acquired): only before that ability resolves. `bind`: `<bind>.made`. */
  | { readonly kind: "cancelBoostAbility"; readonly bind?: string }
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
  /** "Until the end of the phase, treat this card's printed text box as if it were blank" (Edison's Giant Robot). */
  | { readonly kind: "blankTextBox"; readonly target: TargetRef; readonly until: LastingUntil }
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
  /**
   * `of` names cards wherever they are, for a Special resolved out of play: "resolve the 'Special' ability on [the top
   * card of the Invocation deck]". Resolving a Special is not playing the card, so no `cardPlayed` event (FAQ
   * "Depowered (#20)", p. 60: "merely resolved, not played").
   */
  | { readonly kind: "resolveSpecials"; readonly cards?: TargetQuery; readonly of?: TargetRef }
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
      /** `false`: "That attack does not get a boost card" (Escaped Convict) / "do not give the villain a boost card" (I See You). */
      readonly boost?: false;
      /**
       * The attack is against this character instead of the player's identity: "attacks the hero or ally with the
       * highest ATK" (Clash of the Titans). Its controller is the attacked player (RRG 1.8 "Attack (Enemy Activation)",
       * p. 8: "abilities can instead cause an enemy to attack … an ally that player controls … the player is still
       * considered attacked"). The first character the ref names is used.
       */
      readonly targetCharacter?: TargetRef;
      /**
       * `"currentActivation"`: "that villain attacks you after this attack" (Escaped Convict's boost). RRG 1.8
       * "Activation" (p. 6): "the newly initiated activation resolves after the current activation has finished
       * resolving"; ruling, Feb 28, 2026 (1) answer 2: every ability the ongoing attack triggered, Retaliate and
       * responses included, resolves first. With no activation in progress it resolves at once.
       */
      readonly after?: "currentActivation";
    }
  /** "The villain schemes" / "Ultron schemes": a scheme activation; a confused enemy discards its confusion instead. `bind`: `<bind>.made`, `<bind>.threatPlaced`. */
  | {
      readonly kind: "enemyScheme";
      readonly enemies: TargetRef;
      readonly against?: PlayerRef;
      readonly bind?: string;
      readonly boost?: false;
      readonly after?: "currentActivation";
    }
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
  /**
   * "Discard the top N cards of the encounter deck" (Electro, Lightning Bolt, Shock Therapy). The active villain's
   * deck (§3.2); each card goes to its own deck's discard pile (`home`).
   *
   * RRG 1.8 "Encounter Deck" (p. 17): "If a card ability discards a specified number of cards from the encounter
   * deck … discard cards from the encounter deck until the discard condition is met or the encounter deck is empty.
   * If the encounter deck is emptied this way, that card ability is considered to be fulfilled. Do not continue the
   * discard effect with the newly shuffled encounter deck." A deck that was *already* empty when the effect began is
   * reset first (with its acceleration token), and the discarding then happens from the new deck.
   *
   * `bind` binds the discarded cards to that slot and their number to `<bind>.count`. `forEachDiscarded` runs its
   * effects once per discarded card, in discard order, with that card bound to its `slot` ("Each time a Goblin minion
   * is discarded this way, choose …" — the card's own `if` narrows which discards it cares about).
   */
  | {
      readonly kind: "discardEncounterCards";
      readonly count: ValueSpec;
      readonly bind?: string;
      readonly forEachDiscarded?: { readonly slot: string; readonly effects: readonly EffectSpec[] };
    }
  /** "Place a random card from their hand facedown here" — tucked cards are out of play (RRG "Tuck"). */
  | { readonly kind: "tuckCards"; readonly cards: CardSelector; readonly under: TargetRef; readonly facedown?: boolean }
  /** "Assign X damage among heroes and allies": the chooser places it one point at a time; each character then takes its share as one damage event. */
  | { readonly kind: "assignDamage"; readonly amount: ValueSpec; readonly among: TargetQuery; readonly chooser: PlayerRef }
  /**
   * "Deal N indirect damage to each player" / "… to you" (RRG 1.8 "Indirect Damage", p. 24). Each player divides it
   * among the characters they control (one `assignIndirectDamage` choice, `authority: "player"`; user decision,
   * docs/phase7-wave1.md §4.7). A character's cap is its remaining hit points, and a character that cannot take the
   * damage gets none; damage nobody can be assigned is ignored. `"group"`: the first player divides it among every
   * friendly character. Everything assigned then resolves simultaneously as one `damageGroup`. `bind`: `<bind>.amount`
   * (damage taken, summed) and `<bind>.made`.
   */
  | { readonly kind: "dealIndirectDamage"; readonly to: PlayerRef | "group"; readonly amount: ValueSpec; readonly bind?: string }
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
  /**
   * "Attach 1 card from your hand facedown here" (Bruno Carrelli): `facedown` attaches it face down, and a facedown
   * card in play has no title, traits, keywords or abilities until it is turned faceup or leaves play.
   */
  | { readonly kind: "attach"; readonly card: TargetRef; readonly to: TargetRef; readonly facedown?: boolean }
  | { readonly kind: "discardFromPlay"; readonly target: TargetRef }
  /**
   * "Engage that enemy" (Get Over Here!). RRG 1.8 "Engage" (p. 18): "If a card ability instructs a player to engage a
   * minion, that minion is also considered to have engaged that player", and "while a minion is engaged with a
   * player, card abilities cannot cause the minion to engage with the same player again". The minion moves to that
   * player's play area and `minionEngaged` is announced; a minion already engaged with that player is left alone.
   */
  | { readonly kind: "engage"; readonly minion: TargetRef; readonly player: PlayerRef }
  /**
   * "Put the others back in any order" (Heimdall). RRG 1.8 "Deck" (p. 15): a deck's order changes only when a card
   * instructs it. `chooser` orders the cards and they go back on top of the encounter deck in that order, the first
   * card chosen ending up on top.
   */
  | { readonly kind: "reorderCards"; readonly cards: CardSelector; readonly chooser: PlayerRef; readonly to: "encounterDeckTop" }
  /**
   * "Set his hit point dial to 1 instead" (Captain America's Helmet), as a replacement for a defeat. RRG 1.8 "Hit
   * Points" (p. 22): the dial is the character's remaining hit points, so this sets sustained damage to maximum hit
   * points minus `amount`. It is not healing — the card does not say "heal" — so no heal event and no "after you heal"
   * response; logged as `hitPointsSet`. Engine reading, flagged in docs/phase7-wave1.md §3.13.
   */
  | { readonly kind: "setRemainingHitPoints"; readonly target: TargetRef; readonly amount: ValueSpec }
  /**
   * "Increase the amount of damage that event deals by 2" (Embiggen!) / "…the amount of threat that event removes by
   * 2" (Shrink). RRG 1.8 "Event" (p. 19): "If an effect modifies the amount of damage an event deals … and that event
   * deals multiple instances of damage …, each of those instances is modified" (FAQ "Embiggen (#10)" and "Shrink
   * (#11)", p. 59). So this is a bonus on the *card*, applied to every damage / threat-removal that card's abilities
   * produce while it resolves, and it ends when that card finishes resolving — a card returned to hand and replayed
   * in the same phase does not keep it. Prevention is not removal, so Shrink does nothing for a prevent effect.
   */
  | { readonly kind: "modifyCardEffect"; readonly card: TargetRef; readonly damage?: ValueSpec; readonly threatRemoved?: ValueSpec }
  | { readonly kind: "putIntoPlay"; readonly card: TargetRef; readonly controller: PlayerRef }
  /**
   * "Deal an encounter card to each player" / "Deal 2 encounter cards to each player" (Green Goblin II). Cards come
   * from the active villain's deck (§3.2). With more than one player receiving cards the first player chooses the
   * order they receive them (RRG 1.8 "Each Player", p. 17; ruling, Jan 26, 2026 (4) answer 3: "the first player
   * chooses the order players receive cards … Distribution is AABB or BBAA"), so one player's whole share is dealt
   * before the next player's. One player receiving cards is dealt without asking.
   */
  | { readonly kind: "dealEncounterCard"; readonly player: PlayerRef; readonly count?: ValueSpec }
  | { readonly kind: "revealEncounterCard"; readonly player: PlayerRef }
  | { readonly kind: "addAccelerationToken" }
  | { readonly kind: "removeAccelerationToken" }
  /**
   * Advance the main scheme to its next stage (new stage's A-side When Revealed, then its starting threat). Also how the
   * engine finishes a completion after its When Completed abilities. An advance by card text is not a completion. On
   * the final stage it does nothing.
   */
  | { readonly kind: "advanceMainScheme" }
  /**
   * "Move all threat from the side scheme with the least threat to the side scheme with the most threat" (Tactical
   * Prowess); "move 1 threat from a scheme to here" (Beat Cop). `amount` absent moves all of it. RRG 1.8 "Move" (p. 30):
   * "If threat is moved off a scheme, the moved threat is considered to be removed from that scheme. If threat is moved
   * to a scheme, the moved threat is considered to be placed on that scheme", so a `removeThreat` then a `placeThreat`
   * event (docs/phase7-wave1.md §4.8, settled by that entry). No move to the same card, and none with nothing to move or
   * no destination. `bind`: `<bind>.made`, `<bind>.amount` (placed) and `<bind>.forcedResponses`, the number of forced
   * responses the placement triggered ("If that scheme's 'Forced Response' ability is not triggered this way …").
   */
  | { readonly kind: "moveThreat"; readonly from: TargetRef; readonly to: TargetRef; readonly amount?: ValueSpec; readonly bind?: string }
  /**
   * "Place the active counter on Wrecker" / "Move the active counter to the villain whose scheme has the most
   * threat" (The Wrecking Crew insert, "The Active Villain"). Moves it to the first undefeated villain `villain`
   * names; to choose among several (a tie), bind them with `chooseTarget` first. Logged as `activeVillainChanged`.
   */
  | { readonly kind: "setActiveVillain"; readonly villain: TargetRef }
  /**
   * "Flip Norman Osborn and Criminal Enterprise." RRG 1.8 "Flip" (p. 20): a face of the same card type keeps its
   * attached cards, tucked cards, status cards and tokens. Flipping is not revealing (rulings Jan 26, 2026 (4) answer
   * 2; Apr 30, 2026 (3) answer 3; Jun 25, 2026 (4) answer 3), so no reveal procedure and no reveal responses.
   * - A villain changes side on the same stage, and the new face's When Revealed resolves (Green Goblin insert: "Changing
   *   form will trigger Green Goblin's 'When Revealed' ability"). An activation in progress carries on with the new
   *   face's values (FAQ "Green Goblin (#1B)", p. 59).
   * - A double-sided encounter card (`flipSide`) turns to its other face.
   * Either way a `cardFlipped` event follows, for "after this card flips" abilities. A card with one face is unaffected.
   */
  | { readonly kind: "flipCard"; readonly target: TargetRef }
  /**
   * Parks a `chooseTarget` choice for `chooser` and binds the answer to `slot`.
   *
   * `count` is how many are chosen (default 1) and may be a `ValueSpec`: "deal 1 damage to X enemies", where X was
   * bound by the ability's cost (Shield Toss). With `optional`, "up to X" (Thunderclap). The choices are distinct
   * cards, so "different enemies" needs nothing further — and a villain is one enemy however many stages its deck
   * has (FAQ "Melee (#30)", p. 59: "different stages of the villain are considered to be the same enemy").
   */
  | {
      readonly kind: "chooseTarget";
      readonly slot: string;
      readonly query: TargetQuery;
      readonly chooser: PlayerRef;
      readonly count?: number | ValueSpec;
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

/** A player's own out-of-play zones a selector can read. */
export type PlayerZone = "hand" | "deck" | "discard";

/** Which cards a `moveCards`/`chooseCards` works on. */
export type CardSelector =
  | { readonly kind: "ref"; readonly ref: TargetRef; readonly filter?: TargetQuery }
  /**
   * The encounter deck and/or discard pile ("search the encounter deck and discard pile for …"): the active
   * villain's (ruling, Jan 17, 2026 (5)). `deckOf` names another villain's deck where card text does ("Reveal the
   * top card of *his* deck", Buddy System). That reading is docs/phase7-wave1.md §4.2's proposal (card text beats
   * the ruling's "only the active villain's encounter deck can be interacted with"), still open for FFG.
   */
  | {
      readonly kind: "encounter";
      readonly zones: readonly ("deck" | "discard")[];
      readonly filter?: TargetQuery;
      readonly top?: ValueSpec;
      readonly deckOf?: TargetRef;
    }
  /** A player's set-aside nemesis set. */
  | { readonly kind: "setAside"; readonly player: PlayerRef; readonly filter?: TargetQuery }
  /** Scenario cards set aside at setup (a signature side scheme before Breakout 1A puts it into play). */
  | { readonly kind: "encounterSetAside"; readonly filter?: TargetQuery }
  /** Cards tucked under a card ("each facedown card here"). */
  | { readonly kind: "tucked"; readonly under: TargetRef }
  /**
   * An identity's separate deck and/or its own discard pile: "the top card of the Invocation deck"
   * (docs/phase7-wave1.md §3.5). `zones` defaults to the deck.
   */
  | {
      readonly kind: "separateDeck";
      readonly player: PlayerRef;
      readonly name: string;
      readonly zones?: readonly ("deck" | "discard")[];
      readonly top?: ValueSpec;
      readonly filter?: TargetQuery;
    }
  | {
      /**
       * A player's own zones. Several at once are searched as one pool: "search your deck **and** discard pile for a
       * Doctor Strange card" (Mystical Studies, For Asgard!, Agent Coulson) is a single choice among everything
       * found, not one choice per zone. `top` applies to each zone; `random` and `topmostOnly` to what they yield.
       */
      readonly kind: "zone";
      readonly zone: PlayerZone | readonly PlayerZone[];
      readonly player: PlayerRef;
      readonly filter?: TargetQuery;
      /** Only the top N cards of the zone (deck top, most recent discards). */
      readonly top?: ValueSpec;
      /** Only the first matching card from the top ("the topmost Tech upgrade"). */
      readonly topmostOnly?: boolean;
      /** N cards chosen at random from the (filtered) zone, per player ("1 card at random from your hand"). */
      readonly random?: ValueSpec;
    };

/**
 * Where `moveCards` puts cards. Player cards go to their owner's zones; `discard` follows each card's `home`.
 * `encounterDeckShuffle` is the active villain's deck (ruling, Jan 17, 2026 (5): Cosmic Entity "shuffles it into
 * the active villain's encounter deck").
 *
 * `separateDiscard`, `separateDeckTop` and `separateDeckShuffle` send a card to the separate deck its `home` names,
 * owned by its owner ("Place this card in the Invocation deck discard pile", "place it back on top of the Invocation
 * deck faceup", "Shuffle the Invocation card under here into the Invocation deck"); any other card is left where it is.
 */
export type CardDestination =
  | "hand"
  | "discard"
  | "deckTop"
  | "deckBottom"
  | "deckShuffle"
  | "removedFromGame"
  | "encounterDeckShuffle"
  | "separateDiscard"
  | "separateDeckTop"
  | "separateDeckShuffle";
