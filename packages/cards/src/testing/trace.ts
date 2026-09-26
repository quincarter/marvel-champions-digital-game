/**
 * Did the ability under test actually fire?
 *
 * **Why this exists.** Two Sniper Shot tests in `wave2/trors/hawkeye.test.ts` were green for months without
 * ever revealing the card under test: `stackSetAside` put it on top of the encounter deck, the villain's own
 * unconditional boost draw ate it before the player's reveal step, and the tests' loose
 * `toBeGreaterThanOrEqual` assertions were satisfied by the villain's independent activation. A test that
 * exercises nothing passes. See `docs/card-scripting-process.md` §3.
 *
 * **How it works.** `EngineDeps.abilities` is a plain record the engine reads as `deps.abilities[id]`, so a
 * Proxy over it sees every lookup — no engine change, and nothing here can affect production code. Two
 * signals, because they mean different things:
 *
 * - **considered** — the engine looked the ability up at all. Legality enumeration reads `.trigger` on every
 *   ability of every card in play (`actions.ts`), so this fires for abilities that were merely *offered*.
 * - **resolved** — the engine read `.effects` to run them: `resolve/ability.ts` `executeAbilityFrame` hands them to
 *   the effect runner (and a resource ability's effects run with its payment). This is the real "it fired" signal.
 *   The one other reader is the engine's offer-time check of whether an ability has a valid target
 *   (`resolve/target-validity.ts` `abilityLacksValidTarget`, RRG 1.8 "Target", p. 42), which runs for abilities
 *   that are merely offered; a read from inside it is not counted (`readForOffer`).
 *
 * An ability whose card never reached play, or was never revealed, shows up in neither.
 */
import type { AbilityDefinition, AbilityRegistry, EngineDeps } from "@mc/engine";

export interface AbilityTrace {
  /** Ability ids the engine looked up at all — includes ones merely offered as legal actions. */
  considered(): ReadonlySet<string>;
  /** Ability ids whose `effects` the engine read, i.e. that actually resolved. */
  resolved(): ReadonlySet<string>;
  /** Forget everything seen so far, to scope a trace to one command. */
  reset(): void;
}

export interface TracedDeps {
  readonly deps: EngineDeps;
  readonly trace: AbilityTrace;
}

/**
 * Whether the current `.effects` read comes from the engine's offer-time target check rather than from resolving the
 * ability. That check is `abilityLacksValidTarget`'s direct read, so it is within the default stack trace depth.
 */
const readForOffer = (): boolean => new Error().stack?.includes("abilityLacksValidTarget") === true;

/**
 * Wraps `deps` so every ability lookup is recorded. Pass the returned `deps` wherever the test would have
 * passed the real one; the definitions behave identically.
 */
export function traceAbilities(base: EngineDeps): TracedDeps {
  const considered = new Set<string>();
  const resolved = new Set<string>();
  // One proxy per definition, cached, so repeated lookups return an identical object and anything comparing
  // definitions by identity still works.
  const wrapped = new Map<string, AbilityDefinition>();

  const wrap = (id: string, definition: AbilityDefinition): AbilityDefinition => {
    const cached = wrapped.get(id);
    if (cached) return cached;
    const proxy = new Proxy(definition, {
      get(target, prop, receiver) {
        if (prop === "effects" && !readForOffer()) resolved.add(id);
        return Reflect.get(target, prop, receiver);
      },
    });
    wrapped.set(id, proxy);
    return proxy;
  };

  const abilities = new Proxy(base.abilities as Record<string, AbilityDefinition>, {
    get(target, prop, receiver) {
      if (typeof prop !== "string") return Reflect.get(target, prop, receiver);
      const definition = Reflect.get(target, prop, receiver) as AbilityDefinition | undefined;
      if (definition === undefined) return undefined;
      considered.add(prop);
      return wrap(prop, definition);
    },
  }) as AbilityRegistry;

  return {
    deps: { ...base, abilities },
    trace: {
      considered: () => new Set(considered),
      resolved: () => new Set(resolved),
      reset: () => {
        considered.clear();
        resolved.clear();
      },
    },
  };
}

const list = (ids: ReadonlySet<string>): string => (ids.size === 0 ? "(none)" : [...ids].sort().join(", "));

/**
 * Asserts the ability actually resolved. Use this in any test whose assertion could be satisfied by something
 * other than the card under test — a villain's own activation, an ongoing effect, a scenario's own threat.
 */
export function expectResolved(trace: AbilityTrace, abilityId: string): void {
  const resolved = trace.resolved();
  if (resolved.has(abilityId)) return;
  const considered = trace.considered();
  const hint = considered.has(abilityId)
    ? "it was looked up (offered as a legal action or checked for a trigger) but its effects never ran"
    : "it was never looked up at all — its card probably never reached play, or was never revealed";
  throw new Error(
    `expected ability ${abilityId} to resolve, but ${hint}.\n  resolved: ${list(resolved)}\n  considered: ${list(considered)}`,
  );
}

/** Asserts the ability did *not* resolve — for "this is correctly prevented" tests. */
export function expectNotResolved(trace: AbilityTrace, abilityId: string): void {
  const resolved = trace.resolved();
  if (!resolved.has(abilityId)) return;
  throw new Error(`expected ability ${abilityId} not to resolve, but it did.\n  resolved: ${list(resolved)}`);
}
