/**
 * The Spanish text of the campaign boxes (the Saga and the Cover; the Briefing, Dossier and story beats follow in later
 * pieces), kept beside `story.ts` as `content/glossary-es.ts` is kept beside its English: a key missing here shows the
 * English.
 *
 * Box names are not here: `campaign-text.ts` takes them from the official Spanish product names already in `es.ts`
 * (`unlock.name.*`, from the Spanish card data's pack names). Villain names are the official Spanish card names (the
 * villain card or its set in `packages/content/raw/marvelcdb/es`); one with no Spanish card there (Kingpin, the Dark
 * Protege, Krahllak) stays English. Taglines, pitches and issue titles are this app's own prose, written in Spanish.
 */

/** A box's tagline and its Cover pitch, by `Campaign.id`. */
export interface CampaignCopyEs {
  readonly tagline: string;
  readonly blurb: string;
}

export const CAMPAIGN_COPY_ES: Readonly<Record<string, CampaignCopyEs>> = {
  trors: {
    tagline: "Una historia en cinco números",
    blurb:
      "Hydra tiene una Gema del Infinito y un plan para el mundo entero. Cada victoria se arrastra al siguiente número. Cada cicatriz también.",
  },
  gmw: {
    tagline: "Una historia en cinco números",
    blurb:
      "Los más buscados de la galaxia acaban de convertirse en los más perseguidos. Cada unidad gastada compra algo más de potencia de fuego. Cada unidad ahorrada no compra nada.",
  },
  mts: {
    tagline: "Una historia en cinco números",
    blurb:
      "Thanos quiere todas las Gemas del universo, y la sombra que proyecta llega de Knowhere a Asgard. Cada carta que la reserva de campaña arrastra es una deuda pagada, o una que aún se debe.",
  },
  sm: {
    tagline: "Una historia en cinco números",
    blurb:
      "Todos los villanos a los que Spider-Man ha esquivado vienen a buscar su turno a la vez, y cada escenario que el equipo gana o pierde mueve una marca en el registro de reputación: una deuda o un favor que viaja al siguiente.",
  },
  mut_gen: {
    tagline: "Una historia en cinco números",
    blurb:
      "Washington quiere una respuesta a la cuestión mutante, y su respuesta es una flota de Centinelas. Los X-Men tienen una noche para demostrar que son personas y no una amenaza, y cada victoria y cada derrota viajan con el papel de cada héroe.",
  },
  mojo: {
    tagline: "Un programa en tres episodios",
    blurb:
      "Mojo ha arrastrado a los héroes al Mojoverso para una nueva temporada, y lo único que importa son las audiencias. Tres episodios, un género distinto cada vez y un aliado afortunado que quizá llegue o quizá no a los créditos.",
  },
  next_evol: {
    tagline: "Una historia en cinco números",
    blurb:
      "Los Merodeadores han venido a por Hope Summers, y X-Force tiene que llegar antes que ellos. Desde los túneles de los Morlock hasta un portal temporal, cada plan secundario que eliges deja un entorno para el siguiente combate.",
  },
  aoa: {
    tagline: "Una historia en cinco números",
    blurb:
      "Los héroes saltaron en el tiempo para detener a un asesino y aterrizaron en un mundo donde Apocalipsis ya ha ganado. Cinco escenarios, una misión y un Capataz sacados de nuevo para cada uno, y un profesor al que salvar.",
  },
  aos: {
    tagline: "Una historia en cinco números",
    blurb:
      "Un especialista de S.H.I.E.L.D. ha desaparecido, y una de las tres personas que dirigen la agencia trabaja para I.M.A. Cinco escenarios, un conjunto de pruebas ocultas y un topo al que nombrar.",
  },
  fne: {
    tagline: "Una historia en seis números",
    blurb:
      "La Cocina del Infierno cae en manos de los subordinados del Kingpin, trabajo a trabajo. Daredevil y Echo tienen que derribarlos en el orden que les reparta la ciudad y luego trepar hasta el hombre que lo dirige todo.",
  },
  shadowland: {
    tagline: "Una historia en tres números",
    blurb:
      "La Mano ha levantado una fortaleza en mitad de la Cocina del Infierno. Abre paso por sus calles, sus salas llenas de trampas y su corazón, mientras una corrupción lenta va royendo tu determinación.",
  },
};

/** An issue's title and billed villain, by `<campaignId>/<nodeId>`. */
export interface IssueCopyEs {
  readonly title: string;
  readonly villain?: string;
}

export const ISSUE_COPY_ES: Readonly<Record<string, IssueCopyEs>> = {
  "trors/crossbones": { title: "Ataque relámpago en la montaña" },
  "trors/absorbing-man": { title: "El muro en la nieve" },
  "trors/taskmaster": { title: "Bienvenidos a Ciudad Hydra" },
  "trors/zola": { title: "La mente en la máquina" },
  "trors/red-skull": { title: "Salve, nada" },
  "gmw/brotherhood-of-badoon": { title: "Los Badoon quieren hablar" },
  "gmw/infiltrate-the-museum": { title: "La Colección" },
  "gmw/escape-the-museum": { title: "La gran fuga" },
  "gmw/nebula": { title: "Más allá de la frontera Kree" },
  "gmw/ronan-the-accuser": { title: "Eh, Ronan. Ese es nuestro sitio." },
  "mts/ebony-maw": { title: "Aterriza la Orden Negra" },
  "mts/tower-defense": { title: "Dos villanos, una torre" },
  "mts/thanos": { title: "El mismísimo Titán Loco" },
  "mts/hela": { title: "Una noche libre, y luego Hel" },
  "mts/loki": { title: "Salve al rey Loki" },
  "sm/sandman": { title: "De pared a pared" },
  "sm/venom": { title: "Algo en el tanque" },
  "sm/mysterio": { title: "Humo y espejos" },
  "sm/sinister-six": { title: "Seis de un mismo palo" },
  "sm/venom-goblin": { title: "Un último truco" },
  "mut_gen/sabretooth": { title: "Llega la Hermandad" },
  "mut_gen/project-wideawake": { title: "Despliegue de Centinelas" },
  "mut_gen/master-mold": { title: "El Molde" },
  "mut_gen/mansion-attack": { title: "Ataque a la mansión" },
  "mut_gen/magneto": { title: "Asteroide M" },
  "mojo/magog": { title: "En directo desde el Mojo-seo" },
  "mojo/spiral": { title: "Fuera de guion" },
  "mojo/mojo": { title: "Final de serie" },
  "next_evol/morlock-siege": { title: "Asedio Morlock" },
  "next_evol/on-the-run": { title: "A la fuga" },
  "next_evol/juggernaut": { title: "Juggernaut" },
  "next_evol/mister-sinister": { title: "Mister Siniestro" },
  "next_evol/stryfe": { title: "Dyscordia" },
  "aoa/unus": { title: "Bienvenidos a la Resistencia" },
  "aoa/four-horsemen": { title: "Los Cuatro Jinetes" },
  "aoa/apocalypse": { title: "La Ciudadela" },
  "aoa/dark-beast": { title: "El portal" },
  "aoa/en-sabah-nur": { title: "Salvar al Profesor" },
  "aos/black-widow": { title: "La especialista desaparecida" },
  "aos/batroc": { title: "La embajada" },
  "aos/modok": { title: "El laboratorio" },
  "aos/thunderbolts": { title: "¿Con la autoridad de quién?" },
  "aos/baron-zemo": { title: "La acusación" },
  "fne/art-museum-heist": { title: "Robo en el museo de arte" },
  "fne/the-getaway": { title: "La huida" },
  "fne/protection-racket": { title: "Extorsión" },
  "fne/the-raft-breakout": { title: "Fuga de la Balsa" },
  "fne/stop-the-presses": { title: "¡Paren las rotativas!" },
  "fne/kingpin": { title: "Kingpin" },
  "shadowland/shadows-in-the-night": { title: "Sombras en la noche" },
  "shadowland/shadow-labyrinth": { title: "Laberinto de sombras" },
  "shadowland/heart-of-shadow": { title: "Corazón de sombras" },
};

/** An issue's billed villain by its English name: the official Spanish card or set name, else not listed (English stands). */
export const VILLAIN_ES: Readonly<Record<string, string>> = {
  Crossbones: "Calavera",
  "Absorbing Man": "Hombre Absorbente",
  Taskmaster: "Supervisor",
  Zola: "Zola",
  "Red Skull": "Cráneo Rojo",
  "Brotherhood of Badoon": "Hermandad de los Badoon",
  "The Collector": "El Coleccionista",
  Nebula: "Nébula",
  "Ronan the Accuser": "Ronan el Acusador",
  "Ebony Maw": "Fauces Negras",
  "Proxima Midnight & Corvus Glaive": "Medianoche Próxima y Corvus Glaive",
  Thanos: "Thanos",
  Hela: "Hela",
  Loki: "Loki",
  Sandman: "Hombre de Arena",
  Venom: "Veneno",
  Mysterio: "Mysterio",
  "The Sinister Six": "Los Seis Siniestros",
  "Venom Goblin": "Duende Veneno",
  Sabretooth: "Dientes de Sable",
  "Project Wideawake": "Proyecto Despertar",
  "Master Mold": "Molde Maestro",
  "The Brotherhood": "La Hermandad de Mutantes",
  Magneto: "Magneto",
  MaGog: "MaGog",
  Spiral: "Espiral",
  Mojo: "Mojo",
  "The Marauders": "Los Merodeadores",
  "A Marauder": "Un Merodeador",
  Juggernaut: "Juggernaut",
  "Mister Sinister": "Mister Siniestro",
  Stryfe: "Dyscordia",
  Unus: "Unus",
  "The Four Horsemen": "Los Cuatro Jinetes",
  Apocalypse: "Apocalipsis",
  "Dark Beast": "Bestia Oscura",
  "En Sabah Nur": "En Sabah Nur",
  "Black Widow": "Viuda Negra",
  Batroc: "Batroc",
  "M.O.D.O.K.": "M.O.D.O.K.",
  Thunderbolts: "Thunderbolts",
  "Baron Zemo": "Barón Zemo",
  "An underling": "Un subordinado",
};
