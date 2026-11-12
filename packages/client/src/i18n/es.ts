/**
 * The Spanish app text (issue #390), over the English catalog (`en.ts`): a key missing here shows in English.
 * Game terms follow the Spanish Rules Reference translation (referenciamc.netlify.app) and the printed Spanish cards.
 */
import type { en } from "./en.js";

export const es: Readonly<Partial<Record<keyof typeof en, string>>> = {
  "title.eyebrow": "EDICIÓN DIGITAL",
  "title.newGame": "Nueva partida",
  "title.starting": "Empezando…",
  "title.decks": "Mazos y colección",
  "title.campaign": "Campaña",
  "title.extras": "Extras",
  "title.trophyRoom": "Sala de logros",
  "title.yourStats": "Tus estadísticas",
  "title.howToPlay": "Aprende a jugar",
  "title.settings": "Opciones",
  "title.quit": "Salir al escritorio",
  "title.updateAvailable": "ACTUALIZACIÓN DISPONIBLE",
  "title.rankUp": "¡NUEVO RANGO!",
  "title.releaseNotes": "Novedades ↗",
};
