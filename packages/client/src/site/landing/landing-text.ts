/**
 * The landing page's text (`site/landing/index.html`), in every page language. Kept short on purpose: the page is led
 * by the game's art and screenshots, and the words only label them. Addresses (`{game}`, `{discord}`, ...) are filled
 * in by `landing.ts` from `site-urls.ts`.
 */
import type { PageLanguage } from "../page-language.js";
import type { Catalog } from "../site-text.js";

const en = {
  "meta.title": "Marvel Champions: Digital Edition · Play free in your browser",
  "meta.description":
    "A fan-made, rules-accurate digital version of the Marvel Champions card game. Free in your browser and on Windows, macOS, Linux, Steam Deck and Android.",
  "bar.brand": "Digital Edition",
  "bar.play": "Play now",
  "bar.download": "Download",
  "nav.heroes": "Heroes",
  "nav.villains": "Villains",
  "nav.mods": "Mods",
  "nav.news": "News",

  "hero.kick": "Fan-made · Free · No account",
  "hero.title": 'Suit up.<br /><span class="g">Save the day.</span>',
  "hero.text": "The cooperative card game, played by the book. In your browser or as an app.",
  "hero.play": "Play in your browser",
  "hero.platforms": "Web · Windows · macOS · Linux · Steam Deck · Android",
  "stat.heroes": "heroes",
  "stat.scenarios": "scenarios",
  "stat.mods": "mods",
  "stat.languages": "English · Español",

  "shots.title": "See it in action",
  "shots.pick": "Show screenshot {n}",
  "shots.scenario": "Choose a villain: every scenario with its own artwork",
  "shots.seats": "Take your seats: up to four heroes, each with their precon",
  "shots.setup": "Setting up the table, step by step as the rulebook says",
  "shots.board": "Your turn against Rhino",

  "story.title": "Story-rich campaigns",
  "story.text":
    "Campaign scenarios that immerse you in the story, chapter by chapter, with comic pages between the fights. Comic art by Joey Vazquez.",
  "story.pick": "Show page {n}",
  "story.mtsTitan": "The Mad Titan's Shadow: Thanos turns his eyes on Earth",
  "story.mtsTitan.alt": "A comic page: Thanos looms over the heroes in The Mad Titan's Shadow",
  "story.mtsBattle": "His Black Order strikes, and every hero answers",
  "story.mtsBattle.alt":
    "A two-page comic battle: the Avengers and the Guardians clash with the Black Order across the city",
  "story.mtsAsgard": "The war reaches all the way to Asgard",
  "story.mtsAsgard.alt": "A two-page comic spread of the fight in Asgard",
  "story.smSwing": "Sinister Motives: a night over New York",
  "story.smSwing.alt": "A comic page: Spider-Man swings through New York at night",
  "story.smSix": "The Sinister Six, all at once",
  "story.smSix.alt": "A comic page: the spider-heroes fight the Sinister Six in a burning lab",
  "story.smGoblin": "And the Goblin waiting at the end",
  "story.smGoblin.alt": "A comic page: the Green Goblin faces the spider-heroes",
  "heroes.title": "{n} heroes",
  "heroes.text": "Every one with their precon deck, or build your own.",
  "heroes.all": "All",
  "aspect.aggression": "Aggression",
  "aspect.justice": "Justice",
  "aspect.leadership": "Leadership",
  "aspect.protection": "Protection",
  "aspect.pool": "'Pool",

  "villains.title": "{n} scenarios",
  "villains.text": "Every villain's encounter deck, modular sets and campaigns.",
  "villains.more": "Show all {n}",
  "villains.less": "Show fewer",

  "mods.title": "Mod Store",
  "mods.text": "Fan-made heroes, scenarios and house rules, one tap to install.",
  "mods.by": "by {creator}",
  "mods.kind.hero": "Hero",
  "mods.kind.scenario": "Scenario",
  "mods.kind.house-rule": "House rule",
  "mods.kind.modular": "Modular set",
  "mods.kind.campaign": "Campaign",
  "mods.kind.art": "Art",
  "mods.empty": "Open the game to browse the store.",
  "mods.batchAlt":
    "Custom content, batch 1: nine fan-made packs for the game, 201 new cards and 24 rebuilt official cards, in English and Spanish. Hero packs Gwenpool, Throg, Carnage, Night Thrasher and Yondu; scenarios The Punisher and Mephisto; house rules Lost Traits and GMW Fixes.",

  "news.title": "What's new",
  "news.released": "{version} · {date}",
  "news.report": "Read the release report",
  "news.notes": "Release notes",
  "news.all": "Every release",

  "dl.title": "Get the game",

  "community.title": "Join the community",
  "community.game": "The game's Discord",
  "community.game.text": "Bugs, ideas, decks and release news.",
  "community.homebrew": "Marvel Champions Homebrew",
  "community.homebrew.en": "Fan-made content, in English.",
  "community.homebrew.es": "Contenido de fans, en español.",
  "community.join": "Join",

  "table.title": "Play at the table",
  "table.proxy": "Print proxies",
  "table.cdb": "Cards and decks",
  "table.hoh": "Rulings",
  "table.mods": "Fan-made print and play",

  "credits.title": "Thank you",
  "credits.mods": "Mod creators",
  "credits.decks": "Deck authors",
  "credits.reporters": "And every player who reports a bug: each release report names them.",
  "credits.assets":
    "The soundtrack is AI-generated with Gemini. Sound effects are royalty-free sounds from assorted websites. Controller art: Akshay Kumar (ArtStation), Uttam Das (Vecteezy), Sweet Farm (Noun Project). Fonts: Bangers, Public Sans and IBM Plex Mono (SIL Open Font License).",

  "foot.releases": "Release history",
  "foot.play": "Play in your browser",
} as const;

export type LandingKey = keyof typeof en;

const es: Catalog<LandingKey> = {
  "meta.title": "Marvel Champions: Digital Edition · Juega gratis en tu navegador",
  "meta.description":
    "Una versión digital fiel a las reglas del juego de cartas Marvel Champions, hecha por fans. Gratis en el navegador y en Windows, macOS, Linux, Steam Deck y Android.",
  "bar.brand": "Digital Edition",
  "bar.play": "Jugar",
  "bar.download": "Descargar",
  "nav.heroes": "Héroes",
  "nav.villains": "Villanos",
  "nav.mods": "Mods",
  "nav.news": "Novedades",

  "hero.kick": "Hecho por fans · Gratis · Sin cuenta",
  "hero.title": 'Equípate.<br /><span class="g">Salva el día.</span>',
  "hero.text": "El juego de cartas cooperativo, según las reglas. En el navegador o como app.",
  "hero.play": "Jugar en el navegador",
  "hero.platforms": "Web · Windows · macOS · Linux · Steam Deck · Android",
  "stat.heroes": "héroes",
  "stat.scenarios": "escenarios",
  "stat.mods": "mods",
  "stat.languages": "English · Español",

  "shots.title": "Míralo en acción",
  "shots.pick": "Mostrar captura {n}",
  "shots.scenario": "Elige un villano: cada escenario con su propia ilustración",
  "shots.seats": "Ocupad vuestros asientos: hasta cuatro héroes, cada uno con su mazo",
  "shots.setup": "Preparando la mesa, paso a paso como dice el reglamento",
  "shots.board": "Tu turno contra Rhino",

  "story.title": "Campañas llenas de historia",
  "story.text":
    "Escenarios de campaña que te sumergen en la historia, capítulo a capítulo, con páginas de cómic entre los combates. Arte del cómic de Joey Vazquez.",
  "story.pick": "Mostrar página {n}",
  "story.mtsTitan": "La Sombra del Titán Loco: Thanos pone sus ojos en la Tierra",
  "story.mtsTitan.alt": "Una página de cómic: Thanos se cierne sobre los héroes en La Sombra del Titán Loco",
  "story.mtsBattle": "Su Orden Negra ataca, y todos los héroes responden",
  "story.mtsBattle.alt":
    "Una batalla de cómic a doble página: los Vengadores y los Guardianes contra la Orden Negra por toda la ciudad",
  "story.mtsAsgard": "La guerra llega hasta Asgard",
  "story.mtsAsgard.alt": "Una doble página de cómic con la lucha en Asgard",
  "story.smSwing": "Motivos Siniestros: una noche sobre Nueva York",
  "story.smSwing.alt": "Una página de cómic: Spider-Man se balancea por Nueva York de noche",
  "story.smSix": "Los Seis Siniestros, todos a la vez",
  "story.smSix.alt": "Una página de cómic: los héroes araña contra los Seis Siniestros en un laboratorio en llamas",
  "story.smGoblin": "Y el Duende esperando al final",
  "story.smGoblin.alt": "Una página de cómic: el Duende Verde frente a los héroes araña",
  "heroes.title": "{n} héroes",
  "heroes.text": "Cada uno con su mazo preconstruido, o construye el tuyo.",
  "heroes.all": "Todos",
  "aspect.aggression": "Agresividad",
  "aspect.justice": "Justicia",
  "aspect.leadership": "Liderazgo",
  "aspect.protection": "Protección",
  "aspect.pool": "'Pool",

  "villains.title": "{n} escenarios",
  "villains.text": "El mazo de encuentros de cada villano, sets modulares y campañas.",
  "villains.more": "Ver los {n}",
  "villains.less": "Ver menos",

  "mods.title": "Tienda de Mods",
  "mods.text": "Héroes, escenarios y reglas caseras hechos por fans, a un toque de instalarse.",
  "mods.by": "de {creator}",
  "mods.kind.hero": "Héroe",
  "mods.kind.scenario": "Escenario",
  "mods.kind.house-rule": "Regla casera",
  "mods.kind.modular": "Set modular",
  "mods.kind.campaign": "Campaña",
  "mods.kind.art": "Arte",
  "mods.empty": "Abre el juego para ver la tienda.",
  "mods.batchAlt":
    "Contenido personalizado, lote 1: nueve packs hechos por fans para el juego, 201 cartas nuevas y 24 cartas oficiales rehechas, en inglés y español. Packs de héroe Gwenpool, Throg, Carnage, Night Thrasher y Yondu; escenarios The Punisher y Mephisto; reglas caseras Lost Traits y GMW Fixes.",

  "news.title": "Novedades",
  "news.released": "{version} · {date}",
  "news.report": "Leer el informe de la versión",
  "news.notes": "Notas de la versión",
  "news.all": "Todas las versiones",

  "dl.title": "Consigue el juego",

  "community.title": "Únete a la comunidad",
  "community.game": "El Discord del juego",
  "community.game.text": "Errores, ideas, mazos y noticias de cada versión.",
  "community.homebrew": "Marvel Champions Homebrew",
  "community.homebrew.en": "Fan-made content, in English.",
  "community.homebrew.es": "Contenido de fans, en español.",
  "community.join": "Unirse",

  "table.title": "Juega en la mesa",
  "table.proxy": "Imprime proxies",
  "table.cdb": "Cartas y mazos",
  "table.hoh": "Reglas",
  "table.mods": "Imprime y juega contenido de fans",

  "credits.title": "Gracias",
  "credits.mods": "Creadores de mods",
  "credits.decks": "Autores de mazos",
  "credits.reporters": "Y a cada jugador que informa de un error: cada informe de versión los nombra.",
  "credits.assets":
    "La banda sonora está generada con IA (Gemini). Los efectos de sonido son sonidos libres de derechos de varios sitios web. Arte de mandos: Akshay Kumar (ArtStation), Uttam Das (Vecteezy), Sweet Farm (Noun Project). Fuentes: Bangers, Public Sans e IBM Plex Mono (SIL Open Font License).",

  "foot.releases": "Historial de versiones",
  "foot.play": "Jugar en el navegador",
};

export const LANDING_TEXT: Readonly<Record<PageLanguage, Catalog<LandingKey>>> = { en, es };
