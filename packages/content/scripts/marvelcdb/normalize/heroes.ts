/** Step 3: hero identities — one card per hero record, assembled with its linked alter-ego record. */
import type { HeroFace, HeroIdentityCard, IdentitySeparateDeck, Trait } from "../../../src/schema/index.ts";
import { imageOf, imagesOf } from "./art.ts";
import { brand } from "./brand.ts";
import { abilityRefs, baseFields, expectNoAttach, expectNoPlayerData, imageOfWithOverride, parse, record, type NormalizeContext } from "./context.ts";
import { prepare, type Prepared } from "./prepare.ts";
import type { RawCard } from "../raw-types.ts";

/**
 * A three-sided identity's extra hero face (wave 2, docs/phase7-wave2.md §1.1/§5.1 — Ant-Man's Giant form,
 * Wasp's the same): MarvelCDB publishes it as its own `hero`-type record in the same `card_set_code`, with no
 * `linked_card`, so it never pairs with an alter-ego the way the outside face does.
 */
function buildExtraFace(ctx: NormalizeContext, r: RawCard): { face: HeroFace & { traits: readonly Trait[] }; prepared: Prepared } {
  const p = prepare(ctx, r);
  const parsed = parse(ctx, p);
  expectNoPlayerData(ctx, p, parsed);
  expectNoAttach(ctx, p, parsed);
  const image = imageOf(r.imagesrc);
  return {
    prepared: p,
    face: {
      faceName: p.name,
      traits: p.traits,
      atk: r.attack ?? 0,
      thw: r.thwart ?? 0,
      def: r.defense ?? 0,
      handSize: r.hand_size ?? 0,
      keywords: parsed.keywords,
      text: p.text,
      ...(p.flavor ? { flavor: p.flavor } : {}),
      abilities: abilityRefs(ctx, r.code, p.name, parsed.abilities),
      ...(image ? { image } : {}),
    },
  };
}

export function normalizeHeroes(ctx: NormalizeContext, separateDecksByIdentity: ReadonlyMap<string, IdentitySeparateDeck[]>): void {
  const { errors, topLevel } = ctx;
  const heroRecords = topLevel.filter((x) => x.type_code === "hero");

  // Extra (unlinked) hero faces, grouped by card set — consumed below by whichever record in the same set has
  // the linked alter-ego. A set with an extra face but no such primary is a real error, reported once every
  // primary has had its chance to claim one (the loop below `handled.add`s each extra face it consumes).
  const extraFacesBySet = new Map<string, RawCard[]>();
  for (const r of heroRecords) {
    const ae = r.linked_card;
    if (ae && ae.type_code === "alter_ego") continue;
    if (!r.card_set_code) continue;
    const list = extraFacesBySet.get(r.card_set_code) ?? [];
    list.push(r);
    extraFacesBySet.set(r.card_set_code, list);
  }

  for (const r of heroRecords) {
    const ae = r.linked_card;
    if (!ae || ae.type_code !== "alter_ego") continue;
    const h = prepare(ctx, r);
    const a = prepare(ctx, ae);
    const hp = parse(ctx, h);
    const ap = parse(ctx, a);
    for (const [p, parsed] of [[h, hp], [a, ap]] as const) {
      expectNoPlayerData(ctx, p, parsed);
      expectNoAttach(ctx, p, parsed);
    }
    if (r.health !== ae.health) errors.push(`${r.code}: hero/alter-ego hit points differ`);
    const set = r.card_set_code ?? "";
    const obligations = topLevel.filter((x) => x.type_code === "obligation" && x.card_set_code === set);
    const nemesisSet = `${set}_nemesis`;
    if (obligations.length !== 1) errors.push(`${r.code}: expected exactly one obligation in set ${set}, found ${obligations.length}`);
    if (!topLevel.some((x) => x.card_set_code === nemesisSet)) errors.push(`${r.code}: no nemesis set ${nemesisSet}`);
    const heroImage = imageOfWithOverride(ctx, r.code, r.imagesrc);
    const alterEgoImage = imageOfWithOverride(ctx, ae.code, ae.imagesrc);
    // Record the override in provenance, the same as any other curated data decision (`record`'s notes come from
    // `Prepared.notes`, not from `imageOverrides` itself).
    if (heroImage && !r.imagesrc) h.notes.push(`${r.code}: no artwork on MarvelCDB; art reference substituted from a curated second source [evidence: curation.imageOverrides]`);
    if (alterEgoImage && !ae.imagesrc) a.notes.push(`${ae.code}: no artwork on MarvelCDB; art reference substituted from a curated second source [evidence: curation.imageOverrides]`);
    const separateDecks = separateDecksByIdentity.get(r.code);
    const extraFaceRecords = extraFacesBySet.get(set) ?? [];
    const extraFaces = extraFaceRecords.map((ef) => buildExtraFace(ctx, ef));
    const card: HeroIdentityCard = {
      // MarvelCDB publishes the alter-ego as a linked card rather than a back
      // image, so the pair is assembled here: front is the hero face, back the
      // alter-ego. Each face also carries its own ref below, so a consumer
      // never has to know which side is which.
      ...baseFields(ctx, h, r.code, [r.code, ae.code], imagesOf(r.imagesrc, ae.imagesrc) ?? null),
      type: "hero_identity",
      hp: r.health ?? 0,
      hero: {
        faceName: h.name,
        traits: h.traits,
        atk: r.attack ?? 0,
        thw: r.thwart ?? 0,
        def: r.defense ?? 0,
        handSize: r.hand_size ?? 0,
        keywords: hp.keywords,
        text: h.text,
        ...(h.flavor ? { flavor: h.flavor } : {}),
        abilities: abilityRefs(ctx, r.code, h.name, hp.abilities),
        ...(heroImage ? { image: heroImage } : {}),
      },
      alterEgo: {
        faceName: a.name,
        traits: a.traits,
        rec: ae.recover ?? 0,
        handSize: ae.hand_size ?? 0,
        keywords: ap.keywords,
        text: a.text,
        ...(a.flavor ? { flavor: a.flavor } : {}),
        abilities: abilityRefs(ctx, ae.code, a.name, ap.abilities),
        ...(alterEgoImage ? { image: alterEgoImage } : {}),
      },
      obligationCardId: brand("card", obligations[0]?.code ?? ""),
      nemesisEncounterSetId: brand("encounterSet", nemesisSet),
      ...(separateDecks ? { separateDecks } : {}),
      ...(extraFaces.length > 0 ? { additionalHeroForms: extraFaces.map((f) => f.face) } : {}),
      ...(ctx.curation.identityDeckbuilding?.[r.code] ? { deckbuilding: ctx.curation.identityDeckbuilding[r.code] } : {}),
    };
    ctx.handled.add(r.code).add(ae.code);
    for (const ef of extraFaceRecords) ctx.handled.add(ef.code);
    record(ctx, card, set, [h, a, ...extraFaces.map((f) => f.prepared)]);
  }

  // Any extra face never claimed by a primary identity in its set is a genuine anomaly, not a three-sided
  // identity's inside face — report it the way an unlinked hero record always has been.
  for (const [, records] of extraFacesBySet) {
    for (const r of records) if (!ctx.handled.has(r.code)) errors.push(`${r.code}: hero without a linked alter-ego`);
  }
}
