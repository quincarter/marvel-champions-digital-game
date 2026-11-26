/**
 * The mechanic "Try it" lessons' row titles and taglines in Spanish (`guide/mechanic-tryits.ts` is the English
 * source), by lesson id, for the How to play "New in this box" pages (`view/new-in-box-model.ts`). Hero and card names
 * are the Spanish printed names (`content/card-names-es.ts`); keyword names follow `content/glossary-es.ts`.
 * `new-in-box-model.test.ts` checks every lesson has its Spanish.
 */
export const MECHANIC_TRYITS_ES: Readonly<Record<string, { readonly title: string; readonly tagline: string }>> = {
  storm: {
    title: "Tormenta: el mazo de Clima",
    tagline: "Cambia el Clima en juego y luego usa su Especial.",
  },
  phoenix: {
    title: "Fénix: Contenida y Desatada",
    tagline: "Gasta contadores de poder hasta que la Fuerza Fénix se dé la vuelta.",
  },
  shadowcat: {
    title: "Gatasombra: Sólida y En fase",
    tagline: "Entra en fase para esquivar un golpe y mira cómo vuelve la identidad de masa.",
  },
  gambit: {
    title: "Gambito: contadores de carga",
    tagline: "Acumula contadores de carga y luego gástalos en un ataque.",
  },
  rogue: {
    title: "Pícara: Contacto físico",
    tagline: "Vincula Contacto físico a Rino y mira qué le da el anfitrión.",
  },
  colossus: {
    title: "Coloso: dos cartas «Duro»",
    tagline: "Ten dos cartas «Duro» y luego conviértelas en recursos.",
  },
  psylocke: {
    title: "Mariposa Mental: Cuchillo psiónico y Katana psiónica",
    tagline: "Ataca y luego da la vuelta a una hoja a su cara de Katana.",
  },
  angel: {
    title: "Ángel: tres caras",
    tagline: "Elige Arcángel y luego cambia a Ángel en la ronda siguiente.",
  },
  cable: {
    title: "Cable: planes secundarios de jugador",
    tagline: "Interviene en uno y luego juega un segundo en el límite.",
  },
  x23: {
    title: "X-23: Especialistas",
    tagline: "Derrota Entrenamiento especializado y llévate un Especialista.",
  },
  bishop: {
    title: "Bishop: Absorción de energía",
    tagline: "Recibe un golpe y tu mazo alimenta tu mano.",
  },
  magik: {
    title: "Magik: la primera carta boca arriba",
    tagline: "Juega Limbo y luego elige qué carta se ve arriba.",
  },
  iceman: {
    title: "Hombre de Hielo: Congelación",
    tagline: "Ataca, acepta «¡Congélate!» y mira cómo se vincula Congelación.",
  },
  jubilee: {
    title: "Júbilo: tipos de recurso distintos",
    tagline: "Paga Polvorilla con dos tipos y aturde a Rino.",
  },
  nightcrawler: {
    title: "Rondador Nocturno: ¡Bamf!",
    tagline: "Vincula ¡Bamf! a Rino y luego teletranspórtate para defender.",
  },
  magneto: {
    title: "Magneto: Atracción magnética",
    tagline: "Descarta hasta una carta MAGNÉTICO y añádela a tu mano.",
  },
  nickFury: {
    title: "Nick Furia: Sigilo y Asalto",
    tagline: "Guarda Amenaza en Sigilo y luego gástala en un ataque.",
  },
  mariaHill: {
    title: "María Hill: Reasignación",
    tagline: "Mueve un contador genérico entre dos apoyos S.H.I.E.L.D.",
  },
  silk: {
    title: "Seda: cartas metidas debajo",
    tagline: "Mete debajo una perfidia y luego cámbiala por dos cartas.",
  },
  falcon: {
    title: "Halcón: la primera carta boca arriba",
    tagline: "Mira la primera carta de Encuentro y luego manda a Ala Roja a por sus iconos.",
  },
  blackPanther: {
    title: "Pantera Negra: Inventora y Especiales",
    tagline: "Encuentra una mejora como Shuri y luego resuelve su Especial tras un ataque.",
  },
  zemo: {
    title: "Barón Zemo: la acusación",
    tagline: "Consigue pruebas, lee la cuadrícula y luego nombra al topo.",
  },
  wonderMan: {
    title: "Hombre Maravilla: Fisiología iónica",
    tagline: "Paga de más Ver las estrellas, métela debajo y luego ataca con la bonificación.",
  },
  hercules: {
    title: "Hércules: Trabajo y Don",
    tagline: "Termina una carta de Trabajo, gana un Don y luego juega una carta que abarata.",
  },
};
