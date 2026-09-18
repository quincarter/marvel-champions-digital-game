/**
 * Whether this table may see a card's face.
 *
 * The rule itself now lives in the engine (`@mc/engine`'s `visibility.ts`), because two things need the same answer
 * and must not fork: this module, and the engine's own `preview()`, whose truncation rule is what stops an outcome
 * preview from quietly peeking at a deck. What that rule says is unchanged — a hand and a discard pile are open, a
 * deck is closed except for the cards an open decision is offering out of it, and everything else is open exactly
 * when it is faceup — and the reasoning is written out there.
 *
 * Phase 4 is multi-handed solo — one human plays every seat (PLAN.md Phase 4, "hero seats") — so every hand at the
 * table is that human's own and no hand needs hiding from them. When Phase 5 puts real opponents on the far side of a
 * network, hidden information stops being the client's business at all: the server must not send a card the player
 * may not see, and this function becomes a rendering detail rather than the thing keeping the secret.
 */

export { faceVisible } from "@mc/engine";
