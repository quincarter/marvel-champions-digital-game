/** Step 3: hero identities — one card per hero record, assembled with its linked alter-ego record. */
import type { HeroIdentityCard, IdentitySeparateDeck } from "../../../src/schema/index.ts";
import { imageOf, imagesOf } from "./art.ts";
import { brand } from "./brand.ts";
import { abilityRefs, baseFields, expectNoAttach, expectNoPlayerData, parse, record, type NormalizeContext } from "./context.ts";
import { prepare } from "./prepare.ts";

export function normalizeHeroes(ctx: NormalizeContext, separateDecksByIdentity: ReadonlyMap<string, IdentitySeparateDeck[]>): void {
  const { errors, topLevel } = ctx;
  for (const r of topLevel.filter((x) => x.type_code === "hero")) {
    const ae = r.linked_card;
    if (!ae || ae.type_code !== "alter_ego") {
      errors.push(`${r.code}: hero without a linked alter-ego`);
      continue;
    }
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
    const heroImage = imageOf(r.imagesrc);
    const alterEgoImage = imageOf(ae.imagesrc);
    const separateDecks = separateDecksByIdentity.get(r.code);
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
    };
    ctx.handled.add(r.code).add(ae.code);
    record(ctx, card, set, [h, a]);
  }
}
