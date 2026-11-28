/**
 * "From the pool" (design tiles 24 and 26): one row per resolved pool card this issue's own setup reads back, each with its
 * stripe, picture and a check (helps) or cross (against); or, for the box's finale, one group per destination (a stack on a
 * phone, a grid of boxed groups on a wide column). It fills the wide layout's left column, where "Handled for you" moves right.
 */
import { drawRuleHeading } from "../../handled.js";
import { drawPoolGroupsGrid, drawPoolGroupsStacked } from "./pool-groups.js";
import { drawPoolRow } from "./pool-row.js";
import type { PoolEvents, PoolInput } from "./pool.types.js";
import { poolHeadingIn } from "./pool-text.js";

/** Draws the section from `top`; returns its bottom. */
export function drawPool(input: PoolInput, events: PoolEvents): number {
  const { b, col, pool } = input;
  let y = drawRuleHeading(b, col.x, input.top, col.width, poolHeadingIn(pool.groups ? pool.rows.length : null));
  if (!pool.groups) {
    for (const row of pool.rows) y = drawPoolRow({ ...input, top: y, row }, events);
    return y;
  }
  const groups = { ...input, top: y, groups: pool.groups };
  return col.phone ? drawPoolGroupsStacked(groups, events) : drawPoolGroupsGrid(groups, events);
}
