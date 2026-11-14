/**
 * The "we have moved" page's text (`site/moved/index.html`), in every page language. `{game}` is the game's new
 * address, `{landing}` the landing page's, filled in by `moved.ts`.
 */
import type { PageLanguage } from "../page-language.js";
import type { Catalog } from "../site-text.js";

const en = {
  "meta.title": "We've moved · Marvel Champions: Digital Edition",
  "meta.description":
    "The fan-made Marvel Champions digital game has a new home. Bring your saves across in a few minutes.",
  "top.kick": "Marvel Champions: Digital Edition · New address",
  "top.title": 'We\'ve <span class="g">moved</span>',
  "top.meta": '<span class="v">{gameHost}</span><br />Same game, new address<br />Your saves come with you',
  "intro.pill.small": "New address",
  "intro.pill.big": "{gameHost}",
  "intro.text":
    "<b>The web game now lives at its own address.</b> Nothing about the game changes. Your saves are kept by this browser under the old address, and browsers keep each address's data apart, so <b>they don't move by themselves</b>. The steps below carry them across in a few minutes.",
  "cta.open": "Open the game at its new address",
  "link.replay": "You opened a shared replay. It plays at the game's new address.",
  "link.receive": "You opened a save transfer from another device. Receive it at the game's new address.",
  "link.link": "You opened a device-sync link. Join with it at the game's new address.",
  "link.open": "Open it there",
  "cta.save": "Download my saves",
  "cta.landing": "News, downloads and community",

  "order.band": "Bring your saves",
  "order.lab": "Do it in this order",
  "order.lead":
    "<b>Do steps 1 and 2 on every browser and phone where you played</b>, before anything else. Then do steps 3 to 5 on one device, and step 5 on each of the others.",
  "step1.eb": "Step 1 · Here, on this page",
  "step1.title": "Download your saves",
  "step1.text":
    "One file holds everything this browser saved: games, decks, campaigns, unlocks and settings. Nothing is uploaded; it goes straight to your downloads.",
  "step1.button": "Download my saves",
  "step1.reading": "Reading what this browser saved…",
  "step1.found": "This browser holds {what}.",
  "step1.empty":
    "This browser has nothing saved under the old address. If you played on another browser or phone, open this page there.",
  "step1.blocked": "This browser won't let the page read its saves (a private window, or storage turned off).",
  "step1.done": "Saved {file}. Keep it until step 3 is done.",
  "step1.failed": "The download didn't start: {error}. Try the button again.",
  "step1.mods":
    "<b>Mods you installed don't travel in this file:</b> {names}. Reinstall them at the new address from <b>Extras ▸ Mod Store</b>.",
  "step1.modsGone":
    "<b>{names} has left the Mod Store</b>, so it can't be reinstalled at the new address. Ask its creator in the Homebrew Discord for its files.",
  "step2.eb": "Step 2 · Only if you used sync",
  "step2.title": "Copy your recovery code",
  "step2.on":
    "Sync is on in this browser. Its recovery code is how your other devices and the new address find your synced games. Keep it somewhere safe.",
  "step2.off": "Sync isn't set up in this browser, so there's no code to copy. Skip to step 3.",
  "step2.show": "Show recovery code",
  "step2.hide": "Hide",
  "step2.hidden": "Recovery code, hidden",
  "step2.copy": "Copy code",
  "step2.copied": "Copied",
  "step2.copyFailed": "Couldn't copy it here. The code is shown above: select it and copy it by hand.",
  "step3.eb": "Step 3 · At the new address",
  "step3.title": "Import the file",
  "step3.text":
    'Open <a href="{game}">{gameHost}</a>, then <b>Settings ▸ Save data ▸ Import</b> and pick the file from step 1. Import replaces whatever is at the new address, so <b>do it before you play there</b>.',
  "step4.eb": "Step 4 · If you used sync",
  "step4.title": "Turn sync back on",
  "step4.text":
    "On the same device, open <b>Settings ▸ Save data ▸ Sync ▸ Join with a recovery code</b> and enter the code from step 2. Games you played on other devices come back from your synced copy, and the game asks about any game the two copies disagree on.",
  "step5.eb": "Step 5 · Each of your other devices",
  "step5.title": "Link your other devices again",
  "step5.text":
    "A browser on the old address can't sync any more, so <b>every linked browser and phone joins again</b> at the new address: open it, then <b>Join with a recovery code</b>, or use <b>Link another device</b> on the first device and scan its code. Only import a file there too if that device had games that never synced.",
  "step6.eb": "Last",
  "step6.title": "Update your shortcuts",
  "step6.text":
    "Change bookmarks to the new address. If you added the game to a phone's home screen, remove the old icon and add the new address the same way.",

  "change.band": "What changes, and what doesn't",
  "change.lab": "For web players",
  "change.title": "Changes",
  "change.1": "The web address, to <b>{gameHost}</b>.",
  "change.2": "Saves don't follow the address by themselves: steps 1 and 3 carry them.",
  "change.3": "Browsers you linked for sync join again at the new address (step 5).",
  "change.4": "Home screen shortcuts and bookmarks point at the old address until you change them.",
  "same.title": "Stays the same",
  "same.1": "The game itself, and every save once it's imported.",
  "same.2": "Your recovery code and your synced games.",
  "same.3":
    "<b>The installed apps</b> on Windows, macOS, Linux, Steam Deck and Android keep their saves where they are. Update to the latest version and they point at the new address.",
  "same.4": "Release notes and reports, which move to the new address too.",
  "why.title": "Why we moved",
  "why.text":
    "The game outgrew its free hosting after a lot of you found it at once. Its new home is on our own domain, <b>{domain}</b>, so a future change of host never moves your saves again.",

  "dl.band": "Rather have the app?",
  "dl.lab": "Latest release",
  "dl.lead":
    "<b>The apps keep their saves inside the app</b>, so the address change doesn't touch them. To move web saves into an app, import the file from step 1 the same way.",

  "help.band": "Stuck?",
  "help.text":
    'Ask on the <a href="{discord}">community Discord</a> or <a href="{issues}">open an issue on GitHub</a>. Keep your save file: it\'s the one thing we can\'t recreate.',
  "foot.game": "Play at {gameHost}",
  "foot.landing": "Home page",
  "count.games": "{n} saved games",
  "count.game": "1 saved game",
  "count.decks": "{n} decks",
  "count.deck": "1 deck",
  "count.campaigns": "{n} campaigns",
  "count.campaign": "1 campaign",
  "count.unlocks": "unlocks and points",
  "count.settings": "settings",
  "count.and": "and",
} as const;

export type MovedKey = keyof typeof en;

const es: Catalog<MovedKey> = {
  "meta.title": "Nos hemos mudado · Marvel Champions: Digital Edition",
  "meta.description":
    "El juego digital de Marvel Champions hecho por fans tiene un nuevo hogar. Trae tus partidas guardadas en unos minutos.",
  "top.kick": "Marvel Champions: Digital Edition · Nueva dirección",
  "top.title": 'Nos hemos <span class="g">mudado</span>',
  "top.meta": '<span class="v">{gameHost}</span><br />El mismo juego, otra dirección<br />Tus partidas vienen contigo',
  "intro.pill.small": "Nueva dirección",
  "intro.pill.big": "{gameHost}",
  "intro.text":
    "<b>El juego web ya tiene su propia dirección.</b> El juego no cambia. Tus partidas las guarda este navegador bajo la dirección antigua, y los navegadores separan los datos de cada dirección, así que <b>no se mudan solas</b>. Los pasos de abajo las llevan en unos minutos.",
  "cta.open": "Abrir el juego en su nueva dirección",
  "link.replay": "Has abierto una repetición compartida. Se reproduce en la nueva dirección del juego.",
  "link.receive":
    "Has abierto una transferencia de partidas desde otro dispositivo. Recíbela en la nueva dirección del juego.",
  "link.link": "Has abierto un enlace de sincronización. Únete con él en la nueva dirección del juego.",
  "link.open": "Abrirlo allí",
  "cta.save": "Descargar mis partidas",
  "cta.landing": "Noticias, descargas y comunidad",

  "order.band": "Trae tus partidas",
  "order.lab": "Hazlo en este orden",
  "order.lead":
    "<b>Haz los pasos 1 y 2 en cada navegador y teléfono donde jugaste</b>, antes que nada. Después haz los pasos 3 a 5 en un dispositivo, y el paso 5 en cada uno de los demás.",
  "step1.eb": "Paso 1 · Aquí, en esta página",
  "step1.title": "Descarga tus partidas",
  "step1.text":
    "Un archivo guarda todo lo que tiene este navegador: partidas, mazos, campañas, desbloqueos y opciones. No se sube nada; va directo a tus descargas.",
  "step1.button": "Descargar mis partidas",
  "step1.reading": "Leyendo lo que guardó este navegador…",
  "step1.found": "Este navegador tiene {what}.",
  "step1.empty":
    "Este navegador no tiene nada guardado en la dirección antigua. Si jugaste en otro navegador o teléfono, abre esta página allí.",
  "step1.blocked":
    "Este navegador no deja que la página lea tus partidas (una ventana privada o el almacenamiento desactivado).",
  "step1.done": "Guardado {file}. Consérvalo hasta terminar el paso 3.",
  "step1.failed": "La descarga no empezó: {error}. Vuelve a pulsar el botón.",
  "step1.mods":
    "<b>Los mods que instalaste no viajan en este archivo:</b> {names}. Vuelve a instalarlos en la nueva dirección desde <b>Extras ▸ Mod Store</b>.",
  "step1.modsGone":
    "<b>{names} ya no está en la Tienda de Mods</b>, así que no se puede reinstalar en la nueva dirección. Pide sus archivos a su creador en el Discord Homebrew.",
  "step2.eb": "Paso 2 · Solo si usabas la sincronización",
  "step2.title": "Copia tu código de recuperación",
  "step2.on":
    "La sincronización está activada en este navegador. Su código de recuperación es lo que usan tus otros dispositivos y la nueva dirección para encontrar tus partidas sincronizadas. Guárdalo en un lugar seguro.",
  "step2.off":
    "La sincronización no está configurada en este navegador, así que no hay código que copiar. Pasa al paso 3.",
  "step2.show": "Mostrar código de recuperación",
  "step2.hide": "Ocultar",
  "step2.hidden": "Código de recuperación, oculto",
  "step2.copy": "Copiar código",
  "step2.copied": "Copiado",
  "step2.copyFailed": "No se pudo copiar aquí. El código se muestra arriba: selecciónalo y cópialo a mano.",
  "step3.eb": "Paso 3 · En la nueva dirección",
  "step3.title": "Importa el archivo",
  "step3.text":
    'Abre <a href="{game}">{gameHost}</a>, luego <b>Opciones ▸ Save data ▸ Import</b> (esas pantallas aún están en inglés) y elige el archivo del paso 1. Importar reemplaza lo que haya en la nueva dirección, así que <b>hazlo antes de jugar allí</b>.',
  "step4.eb": "Paso 4 · Si usabas la sincronización",
  "step4.title": "Vuelve a activar la sincronización",
  "step4.text":
    "En el mismo dispositivo, abre <b>Opciones ▸ Save data ▸ Sync ▸ Join with a recovery code</b> e introduce el código del paso 2. Las partidas que jugaste en otros dispositivos vuelven desde tu copia sincronizada, y el juego te pregunta por cualquier partida en la que las dos copias no coincidan.",
  "step5.eb": "Paso 5 · Cada uno de tus otros dispositivos",
  "step5.title": "Vuelve a vincular tus otros dispositivos",
  "step5.text":
    "Un navegador en la dirección antigua ya no puede sincronizar, así que <b>cada navegador y teléfono vinculado se une de nuevo</b> en la nueva dirección: ábrela y elige <b>Join with a recovery code</b>, o usa <b>Link another device</b> en el primero y escanea su código. Importa un archivo allí solo si ese dispositivo tenía partidas que nunca se sincronizaron.",
  "step6.eb": "Por último",
  "step6.title": "Actualiza tus accesos directos",
  "step6.text":
    "Cambia tus marcadores a la nueva dirección. Si añadiste el juego a la pantalla de inicio de un teléfono, quita el icono antiguo y añade la nueva dirección de la misma forma.",

  "change.band": "Qué cambia y qué no",
  "change.lab": "Para quien juega en la web",
  "change.title": "Cambia",
  "change.1": "La dirección web, a <b>{gameHost}</b>.",
  "change.2": "Las partidas no siguen a la dirección por sí solas: los pasos 1 y 3 las llevan.",
  "change.3": "Los navegadores que vinculaste para sincronizar se unen de nuevo en la nueva dirección (paso 5).",
  "change.4": "Los accesos directos y marcadores apuntan a la dirección antigua hasta que los cambies.",
  "same.title": "Sigue igual",
  "same.1": "El juego en sí, y cada partida una vez importada.",
  "same.2": "Tu código de recuperación y tus partidas sincronizadas.",
  "same.3":
    "<b>Las apps instaladas</b> en Windows, macOS, Linux, Steam Deck y Android conservan sus partidas donde están. Actualiza a la última versión y apuntarán a la nueva dirección.",
  "same.4": "Las notas y los informes de cada versión, que también se mudan a la nueva dirección.",
  "why.title": "Por qué nos mudamos",
  "why.text":
    "El juego se quedó pequeño para su alojamiento gratuito cuando muchos lo encontrasteis a la vez. Su nuevo hogar está en nuestro propio dominio, <b>{domain}</b>, así que un cambio de alojamiento futuro nunca volverá a mover tus partidas.",

  "dl.band": "¿Prefieres la app?",
  "dl.lab": "Última versión",
  "dl.lead":
    "<b>Las apps guardan las partidas dentro de la app</b>, así que el cambio de dirección no les afecta. Para pasar las partidas web a una app, importa el archivo del paso 1 de la misma forma.",

  "help.band": "¿Atascado?",
  "help.text":
    'Pregunta en el <a href="{discord}">Discord de la comunidad</a> o <a href="{issues}">abre un issue en GitHub</a>. Conserva tu archivo de partidas: es lo único que no podemos recrear.',
  "foot.game": "Jugar en {gameHost}",
  "foot.landing": "Página de inicio",
  "count.games": "{n} partidas guardadas",
  "count.game": "1 partida guardada",
  "count.decks": "{n} mazos",
  "count.deck": "1 mazo",
  "count.campaigns": "{n} campañas",
  "count.campaign": "1 campaña",
  "count.unlocks": "desbloqueos y puntos",
  "count.settings": "opciones",
  "count.and": "y",
};

export const MOVED_TEXT: Readonly<Record<PageLanguage, Catalog<MovedKey>>> = { en, es };
