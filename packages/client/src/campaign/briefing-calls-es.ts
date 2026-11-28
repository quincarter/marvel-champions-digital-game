/**
 * The Spanish of the Briefing's setup calls (`CampaignStory.setupCalls`: the sheet's name and its one plain sentence,
 * by instruction id) and of Fear No Evil's plain-words "Handled for you" facts (`CampaignStory.handledWords`). Keys are
 * built the way `stories/*.ts` builds the English ones, so the two lists stay the same shape; an id missing here
 * shows the English.
 *
 * Terms and names follow `briefing-copy-es.ts`'s doc comment. Fear No Evil's villains are their Spanish villain cards
 * (Cabeza de Martillo, Hombre Púrpura, María Tifoidea; Bullseye, Electro and Kingpin keep their names), its scenarios
 * the issue titles in `campaign-copy-es.ts`.
 */
import type { HandledWords, SetupCallCopy } from "./story.js";
import { ISSUE_COPY_ES } from "./campaign-copy-es.js";

const call = (name: string, explain: string): SetupCallCopy => ({ name, explain });

const each = (ids: readonly string[], copy: SetupCallCopy): Record<string, SetupCallCopy> =>
  Object.fromEntries(ids.map((id) => [id, copy]));

// MojoMania (`stories/mojo.ts`).
const LONGSHOT = call(
  "Longshot",
  "Longshot estaba en juego cuando acabó el número anterior. Un jugador que elijáis puede mostrarlo y ponerlo en juego, o podéis barajarlo en el mazo de Encuentros.",
);
const MOJO_HEAL = call(
  "Curación (Experto)",
  "Campaña en modo Experto: recibe una carta de Encuentro boca abajo para curar a tu héroe hasta su Vida máxima.",
);

// NeXt Evolution (`stories/next_evol.ts`).
const MC40_HEAL = call(
  "Curación (Experto)",
  "Campaña en modo Experto: paga el precio de este escenario para curar a tu héroe hasta su Vida máxima.",
);
const hopeHurt = (scheme: string) =>
  call(
    "Las heridas de Hope",
    `Hope salió herida en el número anterior. El grupo elige: poner ese daño sobre ella, o poner esa misma Amenaza sobre ${scheme}.`,
  );

// Age of Apocalypse (`stories/aoa.ts`).
const MC45_HEAL = call(
  "Curación (Experto)",
  "Campaña en modo Experto: coloca 3 de Amenaza sobre la misión para curar a tu héroe hasta su Vida máxima, o renuncia. Un héroe que volvió en este escenario paga aquí las 3 de Amenaza, sin una segunda pregunta.",
);
const MC45_REJOIN = call(
  "Volver o quedarse fuera",
  "Campaña en modo Experto: un héroe derrotado en el escenario anterior elige antes de prepararlo. Volver cuesta 3 de Amenaza sobre la misión, que se colocan al curarse, y lo cura hasta su Vida máxima. Un héroe que se queda fuera no cuenta: el escenario se prepara para los héroes que juegan.",
);

// Agents of S.H.I.E.L.D. (`stories/aos.ts`): the nine evidence cards' Setups in scenarios 2 to 5.
const MC50_HEAL = call(
  "Curación (Experto)",
  "Campaña en modo Experto: pon 1 contador de Secreto sobre un Miembro de la junta para curar a tu héroe tanto como su REC, o renuncia. Un héroe que volvió en este escenario lo paga aquí: elige el Miembro de la junta.",
);
const MC50_REJOIN = call(
  "Volver o quedarse fuera",
  "Campaña en modo Experto: un héroe derrotado en el escenario anterior elige antes de prepararlo. Volver cuesta 1 contador de Secreto sobre un Miembro de la junta, que se paga al curarse, y cura tanto como su REC. Un héroe que se queda fuera no cuenta: el escenario se prepara para los héroes que juegan.",
);
const MC50_EVIDENCE = call(
  "Preparación de las pruebas",
  "Cada prueba que tengáis da a cada héroe dos ofertas: poner un contador de Secreto sobre un Miembro de la junta para buscar en tu colección, o poner 1 de Amenaza sobre el plan principal para buscar en tu mazo.",
);
const EVIDENCE_CARD_IDS = ["50185", "50186", "50187", "50188", "50189", "50190", "50191", "50192", "50193"];
const SCENARIOS = [2, 3, 4, 5];

// Fear No Evil (`stories/fne.ts`).
const UNDERLING_NODES = [
  "art-museum-heist",
  "the-getaway",
  "protection-racket",
  "the-raft-breakout",
  "stop-the-presses",
];
const FNE_VILLAIN_CALL = call(
  "Elige el villano",
  "En una primera vez, la opción de la lista recomendada sigue el orden del reglamento (Cabeza de Martillo, Bullseye, Electro, y después Hombre Púrpura o María Tifoidea), y la opción al azar saca uno al que aún no os habéis enfrentado. Si solo quedan Hombre Púrpura y María Tifoidea, elegid a cuál os enfrentáis.",
);

export const SETUP_CALL_COPY_ES: Readonly<Record<string, SetupCallCopy>> = {
  ...each(["mojo.s2.setup.longshot", "mojo.s3.setup.longshot"], LONGSHOT),
  "mojo.s2.setup.recorded-card": call(
    "Carta anotada",
    "Puedes coger la carta que anotaste del mazo de cualquier jugador y ponerla en juego. El plan principal recibe tanta Amenaza como su coste, así que es un trato: ventaja inicial para ti, más presión en la mesa.",
  ),
  "mojo.s3.setup.recorded-cards": call(
    "Cartas anotadas",
    "Puedes coger cada carta que anotaste del mazo de cualquier jugador y ponerla en juego. El plan principal recibe tanta Amenaza como el coste total de las cartas que cojas, así que es un trato: ventaja inicial para ti, más presión en la mesa.",
  ),
  ...each(["mojo.s2.setup.heal", "mojo.s3.setup.heal"], MOJO_HEAL),

  "mc40.s2.setup.morlocks-saved": call(
    "Ayuda Morlock",
    "Por cada Morlock que salvasteis, un jugador que elijáis busca una carta en su mazo y la añade a su mano.",
  ),
  "mc40.s4.setup.hope": hopeHurt("Teletransportado a otro lugar"),
  "mc40.s5.setup.hope": hopeHurt("En las garras de Dyscordia"),
  ...each(
    SCENARIOS.map((n) => `mc40.s${n}.setup.heal`),
    MC40_HEAL,
  ),

  "mc45.setup.ally-search": call(
    "Buscar un Aliado",
    "Busca un Aliado en tu mazo y añádelo a tu mano. Cuenta para tu tamaño de mano.",
  ),
  "mc45.setup.ally-search.expert": call(
    "Buscar un Aliado",
    "Campaña en modo Experto: busca en tu mazo un Aliado que comparta un rasgo con tu héroe y añádelo a tu mano.",
  ),
  "mc45.setup.carried.desperate-measures": call(
    "Medidas desesperadas",
    "Liberar el Núcleo de Seattle fue derrotado, así que cada héroe puede barajar una Medidas desesperadas en su mazo para esta partida. No cuenta para el tamaño del mazo.",
  ),
  ...each(
    SCENARIOS.map((n) => `mc45.s${n}.setup.heal`),
    MC45_HEAL,
  ),
  ...each(
    SCENARIOS.map((n) => `mc45.s${n}.setup.rejoin`),
    MC45_REJOIN,
  ),

  ...each(
    SCENARIOS.map((n) => `mc50.s${n}.setup.heal`),
    MC50_HEAL,
  ),
  ...each(
    SCENARIOS.map((n) => `mc50.s${n}.setup.rejoin`),
    MC50_REJOIN,
  ),
  ...each(
    SCENARIOS.flatMap((n) => EVIDENCE_CARD_IDS.map((id) => `mc50.s${n}.setup.evidence.${id}`)),
    MC50_EVIDENCE,
  ),

  "campaign.nextNode": call(
    "Elige el siguiente escenario",
    "Elige cuál de los escenarios abiertos jugáis a continuación. Los abiertos son los cinco escenarios de subordinados que aún no habéis superado; el villano de cada uno se elige justo después. Kingpin solo llega cuando los cinco están hechos.",
  ),
  "mc60.choice.playthrough": call(
    "¿Primera vez?",
    "Se responde una sola vez para toda la campaña. La primera vez os deja seguir el orden de villanos del reglamento, escenario a escenario, o sacarlos al azar. Si no es la primera vez, todos los villanos salen al azar, sin más preguntas.",
  ),
  ...each(
    UNDERLING_NODES.map((id) => `mc60.${id}.compose.villain`),
    FNE_VILLAIN_CALL,
  ),
};

/** Fear No Evil's villain sets by their Spanish villain card name. */
const FNE_VILLAIN_ES: Readonly<Record<string, string>> = {
  hammerhead: "Cabeza de Martillo",
  bullseye: "Bullseye",
  electro: "Electro",
  purple_man: "Hombre Púrpura",
  typhoid_mary: "María Tifoidea",
};

/** The English option labels of the villain method (`@mc/cards`' `FNE_VILLAIN_LISTED` / `FNE_VILLAIN_RANDOM`). */
const FNE_METHOD_ES: Readonly<Record<string, string>> = {
  "The next villain on the recommended list": "el siguiente villano de la lista recomendada",
  "A random unrecorded villain": "un villano al azar de los no anotados",
};

/** A villain set or a scenario id in Spanish; an id with neither reads as its own words. */
const fneNameOf = (id: string): string =>
  FNE_VILLAIN_ES[id] ?? ISSUE_COPY_ES[`fne/${id}`]?.title ?? id.replace(/[-_]+/g, " ");

/** `stories/fne.ts`'s `handledWords`, sentence for sentence: "" (left out) and undefined (log wording) match it. */
const FNE_HANDLED_WORDS_ES: HandledWords = (fact) => {
  if (fact.kind === "write") {
    if (fact.value.kind === "choice" && fact.field.startsWith("villain.")) {
      return `${fneNameOf(fact.value.option)} es el villano de ${fneNameOf(fact.field.slice("villain.".length))}.`;
    }
    if (fact.field === "unrecordedVillains" && fact.value.kind === "strikeList") {
      const struck = new Set(fact.value.struck);
      const left = (fact.options ?? []).filter((id) => !struck.has(id)).map(fneNameOf);
      return left.length === 0
        ? "Ya os habéis enfrentado a todos los villanos."
        : `Villanos a los que aún no os habéis enfrentado: ${left.join(", ")}.`;
    }
    if (fact.field === "playthrough" || fact.field === "villainMethod" || fact.field === "checks") return "";
    return undefined;
  }
  if (fact.kind === "choice") {
    const picked = fact.picked[0] ?? "";
    switch (fact.slot) {
      case "playthrough":
        return /^first/i.test(picked)
          ? "Es la primera vez que el grupo juega la campaña."
          : "No es la primera vez que el grupo juega la campaña.";
      case "drawA":
      case "drawB":
        return `Ha salido ${fneNameOf(picked)}, que recibe una marca.`;
      case "villainMethod": {
        const method = FNE_METHOD_ES[picked];
        return method === undefined ? undefined : `El grupo eligió ${method}.`;
      }
      case "villain":
        return "";
      default:
        return undefined;
    }
  }
  if (fact.field === "checks" && fact.value.kind === "number") {
    const marks = fact.value.value;
    return `${fneNameOf(fact.nodeId)} tiene ${marks} marca${marks === 1 ? "" : "s"} en el registro de campaña.`;
  }
  return undefined;
};

/** A box's plain-words facts in Spanish, by `Campaign.id` (only the boxes whose story writes `handledWords`). */
export const HANDLED_WORDS_ES: Readonly<Record<string, HandledWords>> = { fne: FNE_HANDLED_WORDS_ES };
