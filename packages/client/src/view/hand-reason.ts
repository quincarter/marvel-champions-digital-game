/**
 * The short tag for a `no_valid_target` play refusal on a hand card. The engine words several different refusals with
 * that one code; "no target" is right only for the ones that really lack a target. A trait-gated card (White Queen,
 * New Recruits while in alter-ego form) says what it needs instead, in a few words; the full sentence is in Inspect.
 */
export function noTargetTag(message: string): string {
  const identityTrait = /^play only if your identity has the (.+) trait$/i.exec(message);
  if (identityTrait) return `needs ${identityTrait[1]}`;
  const controlled = /^play only if you control an? (.+) character$/i.exec(message);
  if (controlled) return `needs ${controlled[1]} in play`;
  if (/play restriction is not met/i.test(message)) return "restricted";
  return "no target";
}
