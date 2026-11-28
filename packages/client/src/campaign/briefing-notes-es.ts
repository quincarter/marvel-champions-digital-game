/**
 * The Spanish of a box's own "Handled for you" rows on the Briefing (`IssueStory.briefingNotes`), by
 * `<campaignId>/<nodeId>`, one entry per English row and in the same order. Only the words are here: each row's
 * status and citation come from the English row (`briefing-text.ts` joins them). An issue missing here, or with a
 * different number of rows, shows the English rows.
 *
 * Terms and names follow `briefing-copy-es.ts`'s doc comment. Agents of S.H.I.E.L.D. uses its cards' own Spanish
 * words: Junta directiva, Miembro de la junta, contador de Secreto, el sobre de I.M.A. / de S.H.I.E.L.D., pruebas.
 */

/** One row's words in Spanish. `repeatDetail` is given exactly where the English row has one. */
export interface BriefingNoteEs {
  readonly title: string;
  readonly detail: string;
  readonly repeatDetail?: string;
}

const row = (title: string, detail: string, repeatDetail?: string): BriefingNoteEs =>
  repeatDetail === undefined ? { title, detail } : { title, detail, repeatDetail };

/** The Mad Titan's Shadow: the Infinity Gauntlet's setup, shared by Thanos and Loki. */
const GAUNTLET_ON = (villain: string) =>
  row(`Guantelete del Infinito vinculado a ${villain}`, "Los seis Entornos de Gema se barajan en su propio mazo.");

/** Agents of S.H.I.E.L.D.: the rows its scenarios 2 to 5 share (`stories/aos.ts`'s `BOARD_BACK` and the rest). */
const BOARD_BACK = row(
  "La Junta directiva vuelve",
  "Cada Miembro de la junta vuelve con los secretos y la cara que anotó el registro. Un miembro que se dio la vuelta sigue siendo un Accesorio.",
);
const EVIDENCE_SETUPS = row(
  "Preparación de las pruebas",
  "Después de renovar las manos iniciales, cada prueba que tengáis ofrece a cada héroe su Preparación: un contador de Secreto para buscar en tu colección, o 1 de Amenaza para buscar en tu mazo.",
);
const EXPERT = row(
  "Campaña en modo Experto",
  "Cada héroe empieza con la Vida que anotó el registro. Un héroe puede poner un contador de Secreto sobre un Miembro de la junta para curarse tanto como su REC. Un héroe derrotado elige antes de preparar el escenario: volver, y pagar ese contador al curarse, o quedarse fuera y no contar.",
);
const RECORDED = (extra: string) =>
  row(
    "Se anota al final",
    `Los secretos y la cara de cada Miembro de la junta van al registro. ${extra}Un Miembro de la junta sin secretos da una prueba.`,
  );

export const BRIEFING_NOTES_ES: Readonly<Record<string, readonly BriefingNoteEs[]>> = {
  "mts/thanos": [
    row("Reserva resuelta en el orden impreso", "Primero los Aliados y las cartas de mazo, después los enemigos."),
    GAUNTLET_ON("Thanos"),
    row(
      "La reserva sigue creciendo",
      "Una victoria aquí puede añadir Calambrazo. Duele, así que derrota a Protocolos de defensa.",
    ),
  ],
  "mts/loki": [
    row("Reserva resuelta en el orden impreso", "Los grupos van de arriba abajo, igual que en la preparación impresa."),
    GAUNTLET_ON("Loki"),
    row("La reserva se cierra", "Último número. No se añade nada más. El registro se cierra después de este."),
  ],

  "sm/venom": [
    row(
      "El registro de reputación sigue en pie",
      "Lo que marcó el grupo en el número anterior ya está en vigor en este.",
    ),
    row(
      "El registro sigue moviéndose",
      "Se gane o se pierda, esta noche añade sus propias marcas antes de la Preparación del siguiente número.",
    ),
  ],
  "sm/venom-goblin": [
    row(
      "El registro de reputación se cierra aquí",
      "Cada marca que hizo el grupo en toda la partida se gasta por fin, para bien o para mal.",
    ),
    row(
      "Puntuación final opcional",
      "El registro puede anotar hasta dónde llegó la reputación, cuando este número se decida en un sentido u otro.",
    ),
  ],

  "mojo/magog": [
    row(
      "Longshot se baraja en el mazo de Encuentros",
      "La preparación lo baraja con todo lo demás. Si está en juego cuando ganas, la campaña lo recuerda.",
    ),
    row(
      "Tu set de género entra en el mazo de Encuentros",
      "El set que elegiste se baraja con las cartas de MaGog, así que este episodio se juega en ese género.",
    ),
    row(
      "Los héroes quedan fijados",
      "Se anota ahora el héroe de cada jugador, y es el mismo durante los tres números.",
    ),
    row(
      "Una victoria tacha el set de género y anota una carta",
      "No podrás volver a elegir este set en el núm. 2, y cada jugador puede anotar un Apoyo o una Mejora.",
    ),
  ],
  "mojo/spiral": [
    row(
      "Tres sets de género, ninguno ya usado",
      "Los sets tachados en el núm. 1 no se vuelven a ofrecer. Cada uno que elijas se baraja en el mazo de Encuentros.",
    ),
    row(
      "Longshot vuelve, o se baraja",
      "Si estaba en juego al acabar el núm. 1, un jugador puede mostrarlo. Si nadie lo hace, o no estaba en juego, se baraja en el mazo de Encuentros.",
    ),
    row(
      "Las cartas anotadas entran en juego",
      "Cada jugador puede coger la carta que anotó del mazo de cualquier jugador y ponerla en juego. Se añade al plan principal tanta Amenaza como el coste total de esas cartas.",
    ),
    row(
      "Una victoria tacha los tres sets",
      "Esos sets ya no estarán disponibles en el núm. 3, y cada jugador puede anotar otro Apoyo u otra Mejora.",
    ),
  ],
  "mojo/mojo": [
    row(
      "Un set de género, más uno por héroe",
      "Los sets que elijas se apartan, y el primero que elijas entra primero. Si quedan menos sets sin tachar de los que hacen falta, se pueden elegir sets tachados una vez agotados los demás.",
    ),
    row(
      "Longshot vuelve, o se baraja",
      "Si estaba en juego al acabar el núm. 2, un jugador puede mostrarlo. Si nadie lo hace, o no estaba en juego, se baraja en el mazo de Encuentros.",
    ),
    row(
      "Todas las cartas anotadas entran en juego",
      "Cada jugador puede coger cada carta que anotó y ponerla en juego. Se añade al plan principal tanta Amenaza como su coste total.",
    ),
    row("Una victoria termina la campaña", "Derrota a Mojo y MojoManía estará completa."),
  ],

  "next_evol/morlock-siege": [
    row(
      "Tu plan secundario entra en juego",
      "El grupo elige un Plan secundario de jugador. Entra en juego y su carta de Encuentro se baraja en el mazo.",
      "El plan secundario que elegisteis la última vez vuelve a entrar en juego, con su carta de Encuentro barajada en el mazo. No se pregunta nada.",
    ),
    row(
      "Los Merodeadores derrotados se anotan",
      "Cada Merodeador al que pongas en fuga se recuerda, así que ninguno vuelve como villano en solitario en el siguiente número.",
    ),
    row(
      "Los Morlocks que salves cuentan",
      "Cada Morlock que siga en juego al ganar te ayudará al principio del siguiente número.",
    ),
  ],
  "next_evol/on-the-run": [
    row(
      "Un nuevo Merodeador, elegido al azar",
      "Los Merodeadores que ya pusiste en fuga salen del mazo, así que el villano es uno al que no has derrotado.",
    ),
    row(
      "Los Morlocks que salvaste echan una mano",
      "Por cada uno, un jugador que elijáis busca una carta en su mazo y la añade a su mano.",
    ),
    row(
      "Un Entorno ganado te ayuda",
      "Si ganaste uno en el número anterior, está en juego, y ahora cada enemigo recibe una carta de estado Duro.",
    ),
    row(
      "Un nuevo plan secundario, un nuevo Entorno",
      "Un plan que no elegiste antes. Derrótalo para ganar su Entorno en todos los números siguientes.",
      "Vuelve el plan que elegisteis la última vez. Derrótalo para ganar su Entorno en todos los números siguientes.",
    ),
  ],
  "next_evol/juggernaut": [
    row(
      "Todos los Entornos ganados están en juego",
      "Cada uno se pone en juego, y Juggernaut empieza con un contador de Inercia por cada uno.",
    ),
    row(
      "Se reparte a Tom Cassidy el Negro",
      "Se reparten boca abajo a cada jugador una o dos cartas de su conjunto. Una carta va al mazo de Encuentros.",
    ),
    row("Se anota el daño de Hope", "Lo herida que esté Hope cuando ganes pasa al siguiente número."),
  ],
  "next_evol/mister-sinister": [
    row(
      "Teletransportado a otro lugar entra en juego",
      "Empieza con Amenaza adicional por cada Entorno ganado que haya en juego.",
    ),
    row(
      "El daño de Hope continúa",
      "El grupo elige: poner ese daño sobre Hope, o poner esa misma Amenaza sobre Teletransportado a otro lugar.",
    ),
    row("Se vuelve a anotar el daño de Hope", "Lo herida que esté cuando ganes pasa al último número."),
  ],
  "next_evol/stryfe": [
    row(
      "Los Entornos ganados están en juego",
      "En las garras de Dyscordia empieza con Amenaza adicional por cada uno. El daño de Hope puede ir ahí en su lugar.",
    ),
    row(
      "Cada jugador muestra un Esbirro o una carta Psiónico",
      "Por orden de jugadores, descarta del mazo de Encuentros hasta que salga una, y después vuelve a barajar la pila de descartes.",
    ),
    row(
      "Una victoria termina la campaña",
      "Derrota a Dyscordia y la campaña está ganada. En Experto, una derrota aquí termina la campaña.",
    ),
  ],

  "aos/black-widow": [
    row(
      "Pruebas preparadas",
      "Una carta de cada tipo se sella en el sobre de I.M.A. sin enseñarla. Las otras seis esperan en el sobre de S.H.I.E.L.D.",
    ),
    row(
      "Junta directiva",
      "Cada Miembro de la junta empieza con 2 contadores de Secreto, y las tres Interferencias de I.M.A. entran en el mazo de Encuentros.",
    ),
    RECORDED("También se anotan los Esbirros y los planes secundarios en juego. "),
  ],
  "aos/batroc": [
    BOARD_BACK,
    row(
      "Nivel de alerta",
      "Empieza con tanta Amenaza como Esbirros y planes secundarios se anotaron tras el escenario 1.",
    ),
    EVIDENCE_SETUPS,
    EXPERT,
    RECORDED("También se anotan los Prisioneros liberados en juego. "),
  ],
  "aos/modok": [
    BOARD_BACK,
    row(
      "Contadores de Cautiverio de la Celda de detención",
      "La Celda de detención de arriba recibe contadores de Cautiverio adicionales: 3 por héroe, menos 1 por héroe por cada Prisionero liberado anotado.",
    ),
    EVIDENCE_SETUPS,
    EXPERT,
    RECORDED("También se marcan los Entornos Adaptoide en juego. "),
  ],
  "aos/thunderbolts": [
    BOARD_BACK,
    EVIDENCE_SETUPS,
    EXPERT,
    RECORDED("También se anotan los Esbirros Thunderbolt en juego. "),
  ],
  "aos/baron-zemo": [
    BOARD_BACK,
    row(
      "Vuelven los Adaptoides",
      "Cada Entorno Adaptoide marcado en el registro entra en juego, y cada Esbirro Adaptoide entra en el mazo de Encuentros.",
    ),
    row(
      "Vuelven los Thunderbolts",
      "Los Thunderbolts supervivientes y sus conjuntos de Encuentros, salvo el de Jolt, se barajan en el mazo de Encuentros.",
    ),
    row(
      "Sobres apartados",
      "Los sobres de I.M.A. y de S.H.I.E.L.D. se guardan para la acusación. En este escenario, las pruebas solo se consiguen con la oferta de Zemo.",
    ),
    EVIDENCE_SETUPS,
    EXPERT,
  ],
};
