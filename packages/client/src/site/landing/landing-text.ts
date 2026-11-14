/**
 * The landing page's text (`site/landing/index.html`), in every page language. Addresses (`{game}`, `{discord}`, ...)
 * are filled in by `landing.ts` from `site-urls.ts`.
 */
import type { PageLanguage } from "../page-language.js";
import type { Catalog } from "../site-text.js";

const en = {
  "meta.title": "Marvel Champions: Digital Edition · Play free in your browser",
  "meta.description":
    "A fan-made, rules-accurate digital version of the Marvel Champions card game. Free in your browser and on Windows, macOS, Linux, Steam Deck and Android.",
  "top.kick": "Marvel Champions: Digital Edition · Fan-made and free",
  "top.title": 'Suit up. <span class="g">Save the day.</span>',
  "top.meta":
    'Latest <span class="v">v{version}</span><br />Web · Windows · macOS · Linux · Android<br />English · Español',
  "intro.pill.small": "Free · No account",
  "intro.pill.big": "1 to 4 heroes, one player or a table",
  "intro.text":
    "<b>The cooperative card game, played by the book.</b> Pick your heroes, build a deck or take a precon, and face the villain's encounter deck with every rule and card text run the way the Rules Reference says. It plays in your browser and as an app, with a controller or a touchscreen.",
  "cta.play": "Play in your browser",
  "cta.download": "Download the app",
  "cta.discord": "Join the Discord",

  "num.heroes": "Heroes",
  "num.heroes.p": "playable, each with its precon deck.",
  "num.scenarios": "Scenarios",
  "num.scenarios.p": "villains and campaigns from every wave.",
  "num.mods": "Mods",
  "num.mods.p": "fan-made heroes, scenarios and house rules in the store.",
  "num.platforms": "Platforms",
  "num.platforms.p": "web, Windows, macOS, Linux and Android.",

  "new.band": "What's new",
  "new.lab": "Latest release",
  "new.released": "Released {date}",
  "new.report": "Read the release report",
  "new.notes": "Release notes",
  "feed.title": "Recent releases",
  "feed.all": "Every release",

  "shots.band": "On the table",
  "shots.lab": "Screenshots from recent releases",

  "heroes.band": "Heroes you can play",
  "heroes.lab": "{heroes} heroes · {scenarios} scenarios",
  "heroes.lead":
    "<b>Every hero below plays with their precon deck</b>, and you can build your own from the cards the game has. New waves arrive as they're scripted and tested.",
  "aspect.aggression": "Aggression",
  "aspect.justice": "Justice",
  "aspect.leadership": "Leadership",
  "aspect.protection": "Protection",
  "aspect.pool": "'Pool",

  "mods.band": "From the Mod Store",
  "mods.lab": "Fan-made content",
  "mods.lead":
    "<b>Fan creators' heroes, scenarios and house rules</b>, scripted for the game and installed from <b>Extras ▸ Mod Store</b>. Each one is credited to the people who made it.",
  "mods.by": "by {creator}",
  "mods.kind.hero": "Hero",
  "mods.kind.scenario": "Scenario",
  "mods.kind.house-rule": "House rule",
  "mods.kind.modular": "Modular set",
  "mods.kind.campaign": "Campaign",
  "mods.kind.art": "Art",
  "mods.loading": "Loading the store…",
  "mods.empty": "The store's list couldn't be reached right now. Open the game to browse it.",

  "dl.band": "Get the game",
  "dl.lab": "Latest release",
  "dl.lead":
    "<b>The browser version needs nothing installed.</b> The apps play offline, keep their saves on your device, and update from inside the game.",

  "community.band": "Community",
  "community.lab": "Come say hi",
  "discord.game.title": "The game's Discord",
  "discord.game.text":
    "Report bugs, suggest features, share decks and hear about releases first. Players and the people building the game hang out here.",
  "discord.game.button": "Join the game's Discord",
  "discord.homebrew.title": "Marvel Champions Homebrew",
  "discord.homebrew.text":
    "The community where fan-made heroes, villains and campaigns are designed and shared, including many in the Mod Store.",
  "discord.homebrew.en": "Homebrew Discord (English)",
  "discord.homebrew.es": "Homebrew Discord (Español)",
  "discord.issues.title": "Found a bug?",
  "discord.issues.text":
    "Use <b>Pause ▸ Report a problem</b> in the game, which attaches your game, or open an issue on GitHub.",
  "discord.issues.button": "Open an issue",

  "table.band": "Play at the table",
  "table.lab": "Print and play",
  "table.lead":
    "<b>Want the cards in your hands?</b> These are the places the community uses to look up cards, build decks and print proxies of fan-made content.",
  "table.proxy.title": "Proxy Nexus",
  "table.proxy.text": "Build print-ready proxy sheets of Marvel Champions cards, official and fan-made.",
  "table.cdb.title": "MarvelCDB",
  "table.cdb.text": "The card database and deck builder. The game imports decks from it by link.",
  "table.hoh.title": "Hall of Heroes",
  "table.hoh.text": "Rulings, keyword lists and a card browser for every release.",
  "table.mods.title": "Fan-made content",
  "table.mods.text":
    "Mod creators share their print-and-play files in the Homebrew Discord, under each creator's own channel.",
  "table.visit": "Visit",

  "credits.band": "Thank you",
  "credits.side":
    "This game is built on the work of a lot of generous people. Without them there would be no Mod Store, no recommended decks and far fewer fixes.",
  "credits.mods.title": "Mod creators",
  "credits.decks.title": "Deck authors",
  "credits.decks.text": "Decks by these MarvelCDB authors are among the game's recommended decks.",
  "credits.community.title": "Players who report",
  "credits.community.text":
    "Every release report thanks the players whose reports and pull requests shaped it. Read them in the release feed above.",
  "credits.assets":
    "The soundtrack is AI-generated with Gemini. The sound effects are royalty-free sounds from assorted websites. Controller art: Xbox One controller by Akshay Kumar (ArtStation), PlayStation controller by Uttam Das (Vecteezy), Switch icon by Sweet Farm (Noun Project). Fonts: Bangers, Public Sans and IBM Plex Mono, under the SIL Open Font License.",

  "foot.releases": "Release history",
  "foot.play": "Play in your browser",
} as const;

export type LandingKey = keyof typeof en;

const es: Catalog<LandingKey> = {
  "meta.title": "Marvel Champions: Digital Edition · Juega gratis en tu navegador",
  "meta.description":
    "Una versión digital fiel a las reglas del juego de cartas Marvel Champions, hecha por fans. Gratis en el navegador y en Windows, macOS, Linux, Steam Deck y Android.",
  "top.kick": "Marvel Champions: Digital Edition · Hecho por fans y gratis",
  "top.title": 'Equípate. <span class="g">Salva el día.</span>',
  "top.meta":
    'Última versión <span class="v">v{version}</span><br />Web · Windows · macOS · Linux · Android<br />English · Español',
  "intro.pill.small": "Gratis · Sin cuenta",
  "intro.pill.big": "De 1 a 4 héroes, en solitario o en grupo",
  "intro.text":
    "<b>El juego de cartas cooperativo, jugado según las reglas.</b> Elige tus héroes, construye un mazo o usa uno preconstruido, y enfréntate al mazo de encuentros del villano con cada regla y cada texto de carta resueltos como dice la Referencia de Reglas. Funciona en el navegador y como app, con mando o pantalla táctil.",
  "cta.play": "Jugar en el navegador",
  "cta.download": "Descargar la app",
  "cta.discord": "Únete al Discord",

  "num.heroes": "Héroes",
  "num.heroes.p": "jugables, cada uno con su mazo preconstruido.",
  "num.scenarios": "Escenarios",
  "num.scenarios.p": "villanos y campañas de cada oleada.",
  "num.mods": "Mods",
  "num.mods.p": "héroes, escenarios y reglas caseras hechos por fans en la tienda.",
  "num.platforms": "Plataformas",
  "num.platforms.p": "web, Windows, macOS, Linux y Android.",

  "new.band": "Novedades",
  "new.lab": "Última versión",
  "new.released": "Publicada el {date}",
  "new.report": "Leer el informe de la versión",
  "new.notes": "Notas de la versión",
  "feed.title": "Versiones recientes",
  "feed.all": "Todas las versiones",

  "shots.band": "En la mesa",
  "shots.lab": "Capturas de versiones recientes",

  "heroes.band": "Héroes que puedes jugar",
  "heroes.lab": "{heroes} héroes · {scenarios} escenarios",
  "heroes.lead":
    "<b>Cada héroe de la lista se juega con su mazo preconstruido</b>, y puedes construir el tuyo con las cartas que tiene el juego. Las nuevas oleadas llegan a medida que se programan y se prueban.",
  "aspect.aggression": "Agresividad",
  "aspect.justice": "Justicia",
  "aspect.leadership": "Liderazgo",
  "aspect.protection": "Protección",
  "aspect.pool": "'Pool",

  "mods.band": "De la Tienda de Mods",
  "mods.lab": "Contenido hecho por fans",
  "mods.lead":
    "<b>Héroes, escenarios y reglas caseras de creadores de la comunidad</b>, programados para el juego e instalados desde <b>Extras ▸ Mod Store</b>. Cada uno lleva el nombre de quienes lo crearon.",
  "mods.by": "de {creator}",
  "mods.kind.hero": "Héroe",
  "mods.kind.scenario": "Escenario",
  "mods.kind.house-rule": "Regla casera",
  "mods.kind.modular": "Set modular",
  "mods.kind.campaign": "Campaña",
  "mods.kind.art": "Arte",
  "mods.loading": "Cargando la tienda…",
  "mods.empty": "No se pudo cargar la lista de la tienda ahora mismo. Abre el juego para verla.",

  "dl.band": "Consigue el juego",
  "dl.lab": "Última versión",
  "dl.lead":
    "<b>La versión de navegador no necesita instalar nada.</b> Las apps funcionan sin conexión, guardan las partidas en tu dispositivo y se actualizan desde el propio juego.",

  "community.band": "Comunidad",
  "community.lab": "Ven a saludar",
  "discord.game.title": "El Discord del juego",
  "discord.game.text":
    "Informa de errores, sugiere ideas, comparte mazos y entérate antes de cada versión. Aquí están los jugadores y quienes construyen el juego.",
  "discord.game.button": "Únete al Discord del juego",
  "discord.homebrew.title": "Marvel Champions Homebrew",
  "discord.homebrew.text":
    "La comunidad donde se diseñan y comparten héroes, villanos y campañas hechos por fans, incluidos muchos de la Tienda de Mods.",
  "discord.homebrew.en": "Discord Homebrew (English)",
  "discord.homebrew.es": "Discord Homebrew (Español)",
  "discord.issues.title": "¿Encontraste un error?",
  "discord.issues.text":
    "Usa <b>Pausa ▸ Report a problem</b> en el juego, que adjunta tu partida, o abre un issue en GitHub.",
  "discord.issues.button": "Abrir un issue",

  "table.band": "Juega en la mesa",
  "table.lab": "Imprime y juega",
  "table.lead":
    "<b>¿Quieres las cartas en la mano?</b> Estos son los sitios que usa la comunidad para consultar cartas, construir mazos e imprimir proxies de contenido hecho por fans.",
  "table.proxy.title": "Proxy Nexus",
  "table.proxy.text": "Crea hojas de proxies listas para imprimir de cartas de Marvel Champions, oficiales y de fans.",
  "table.cdb.title": "MarvelCDB",
  "table.cdb.text": "La base de datos de cartas y constructor de mazos. El juego importa mazos de ahí con un enlace.",
  "table.hoh.title": "Hall of Heroes",
  "table.hoh.text": "Aclaraciones de reglas, listas de palabras clave y un buscador de cartas de cada producto.",
  "table.mods.title": "Contenido de fans",
  "table.mods.text":
    "Los creadores de mods comparten sus archivos para imprimir y jugar en el Discord Homebrew, en el canal de cada creador.",
  "table.visit": "Visitar",

  "credits.band": "Gracias",
  "credits.side":
    "Este juego se apoya en el trabajo de mucha gente generosa. Sin ella no habría Tienda de Mods, ni mazos recomendados, y habría muchos menos arreglos.",
  "credits.mods.title": "Creadores de mods",
  "credits.decks.title": "Autores de mazos",
  "credits.decks.text": "Los mazos de estos autores de MarvelCDB están entre los mazos recomendados del juego.",
  "credits.community.title": "Quienes informan",
  "credits.community.text":
    "Cada informe de versión da las gracias a quienes con sus avisos y pull requests le dieron forma. Léelos en las versiones de arriba.",
  "credits.assets":
    "La banda sonora está generada con IA (Gemini). Los efectos de sonido son sonidos libres de derechos de varios sitios web. Arte de mandos: mando de Xbox One de Akshay Kumar (ArtStation), mando de PlayStation de Uttam Das (Vecteezy), icono de Switch de Sweet Farm (Noun Project). Fuentes: Bangers, Public Sans e IBM Plex Mono, bajo la SIL Open Font License.",

  "foot.releases": "Historial de versiones",
  "foot.play": "Jugar en el navegador",
};

export const LANDING_TEXT: Readonly<Record<PageLanguage, Catalog<LandingKey>>> = { en, es };
