import type { TargetRef } from "@mc/engine";
import { addCounters, countersOn, query, self, yourIdentity } from "../../../dsl/index.js";

/** The counter type Iron Fist's identity and his cards use ("chi counters"). */
export const CHI = "chi";

/** Chi counters on your identity, "from your identity" in either form (RRG 1.8 "Identity-Specific Card", p. 23). */
export const chiOnYourIdentity = () => countersOn(yourIdentity, CHI);

/** The identity as a query, for `removeCountersAmong` ("remove up to N chi counters from your identity"). */
export const YOUR_IDENTITY_QUERY = query("identity", { controller: "you" });

/**
 * "Place N chi counter(s) on <target>" (default: this card, the identity). Every placement of chi goes through this
 * one `addCounters` effect, so a "would place counters" interrupt (Lack of Chi, 64034) sees them all.
 */
export const placeChi = (n = 1, target: TargetRef = self) => addCounters(CHI, n, target);

/*
 * Lack of Chi (64034) redirects chi through a "would place counters" interrupt, which hears only `addCounters` effects.
 * A counter placed as a cost (`placeCountersCost`) or moved (`moveCounters`) is not heard, so no chi placement may be
 * written either way: always `placeChi`.
 */
