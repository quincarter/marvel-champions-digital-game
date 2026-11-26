/**
 * The rules glossary in Spanish (`@mc/content`'s `schema/glossary.ts` `GLOSSARY_ENTRIES` is the English source), by
 * entry id: the term's name, its definition and, where the entry has one, its player note. Also the four entries the
 * client adds itself (`view/rules-reference.ts`: exhausted, ready, facedown boost card, aspect card). The Rules
 * reference reads these when the card language is Spanish; `glossary-es.test.ts` checks every entry has its Spanish.
 *
 * Keyword and game-term names follow the official Spanish rules reference (Asmodee España's "Guía de referencia",
 * `docs/rules/es/mc_guia_de_referencia_es_2019.md`) and, for keywords that came after it, the printed Spanish cards
 * (MarvelCDB's Spanish card text, `content/card-text-es.ts`): Guardia, Brutalidad, Peligro, Ataque veloz, Represalia,
 * Oleada, Dureza, Usos, Incitar, Permanente, Penetrante, A distancia, Inicio, Infame, Equipo, Complicación, Patrulla,
 * Firmeza, Victoria, Alianza, Tesón, Requisito, Temporal, Trabajo en equipo, Asalto, Vulnerable, Descuento, Enlazada,
 * Requiere, Mano inicial, Identidad de [tipo]. Card names are the Spanish printed names (`content/card-names-es.ts`)
 * where the Spanish data has them, and stay in English where it does not. Citations, page numbers, set codes and
 * dates stay as written. Like the English, every definition is an original paraphrase, not FFG's wording.
 */
export interface GlossaryTextEs {
  readonly name: string;
  readonly definition: string;
  /** Only for an entry whose English has a `playerNote`. */
  readonly note?: string;
}

export const GLOSSARY_ES: Readonly<Record<string, GlossaryTextEs>> = {
  // Keywords.
  guard: {
    name: "Guardia",
    definition:
      "Mientras haya un esbirro con esta palabra clave enfrentado a ti, ninguna de tus cartas puede atacar al villano. No puedes jugar una carta de ataque cuyo único objetivo sea el villano protegido.",
  },
  overkill: {
    name: "Brutalidad",
    definition:
      "Si un ataque con esta palabra clave derrota a un aliado o a un esbirro, el daño que sobre después de derrotarlo pasa a la identidad del controlador de ese aliado o al villano, en vez de perderse.",
  },
  peril: {
    name: "Peligro",
    definition:
      "Mientras se resuelve una carta con esta palabra clave, el jugador que la resuelve no puede pedir consejo a sus compañeros, y nadie más puede jugar cartas ni usar capacidades, incluidas las de la propia carta de Peligro mientras esté en la zona de juego de ese jugador.",
  },
  quickstrike: {
    name: "Ataque veloz",
    definition:
      "Un esbirro con esta palabra clave ataca al héroe al que acaba de enfrentarse, justo después de enfrentarse a él. Si el esbirro se está mostrando, el ataque llega después de su «Cuando se muestre esta carta».",
    note: "Aquí el Ataque veloz llega después del «Cuando se muestre esta carta» del esbirro (reglas, p. 36); una aclaración anterior decía que antes.",
  },
  restricted: {
    name: "Restringida",
    definition:
      "Un jugador nunca puede tener más de dos cartas restringidas en juego a la vez; si alguna vez queda una tercera en juego bajo su control, descarta al momento hasta quedarse con dos, a su elección.",
  },
  retaliate: {
    name: "Represalia X",
    definition:
      "Después de que se ataque a un personaje con Represalia X, este inflige automáticamente X de daño a quien lo atacó, siempre que siga en juego cuando el ataque termine de resolverse.",
  },
  surge: {
    name: "Oleada",
    definition:
      "Cuando se muestra una carta con esta palabra clave, el mismo jugador se reparte al momento otra carta de Encuentro boca abajo, como un efecto de «Cuando se muestre esta carta» que también puede anularse.",
  },
  toughness: {
    name: "Dureza",
    definition:
      "Un personaje con esta palabra clave entra en juego ya con una carta de Estado «Duro», también cuando entra en juego durante la preparación.",
  },
  uses: {
    name: "Usos (X «tipo»)",
    definition:
      "Una carta con esta palabra clave entra en juego con X contadores del tipo indicado; su propia capacidad gasta esos contadores como (parte de) su coste, y la carta se descarta cuando se queda sin el último.",
  },
  incite: {
    name: "Incitar X",
    definition:
      "Cuando se muestra una carta con Incitar X, coloca al momento X de Amenaza sobre el plan principal. Es un efecto aparte del resto del texto de la carta, así que ocurre aunque el resto de la carta no haga nada.",
  },
  permanent: {
    name: "Permanente",
    definition:
      "Una carta permanente no puede ser derrotada, salir del juego ni quedar con el texto en blanco, salvo por capacidades de su propio conjunto (héroe, escenario o modular). Se aparta antes de la preparación y la pone en juego más tarde la capacidad de otra carta, o su propia palabra clave Inicio si la tiene. No cuenta para el tamaño de tu mazo.",
  },
  piercing: {
    name: "Penetrante",
    definition:
      "Un ataque con esta palabra clave descarta cualquier carta de Estado «Duro» de su objetivo antes de infligir daño, así que «Duro» no lo detiene.",
  },
  ranged: {
    name: "A distancia",
    definition:
      "Un ataque con esta palabra clave ignora la Represalia: el personaje con Represalia no devuelve daño por ese ataque.",
  },
  setup: {
    name: "Inicio",
    definition:
      "Una carta con esta palabra clave empieza la partida ya en juego: se coloca durante la preparación, en vez de robarse y jugarse con normalidad.",
  },
  villainous: {
    name: "Infame",
    definition:
      "Un personaje con esta palabra clave recibe una carta de Aumento boca abajo cada vez que usa un atributo básico; la carta se pone boca arriba y sus iconos o su capacidad de Aumento solo se aplican a ese uso. Solo recibe carta de Aumento así el personaje que se activa.",
  },
  teamUp: {
    name: "Equipo",
    definition:
      "Esta palabra clave nombra a dos personajes. Un jugador solo puede incluir la carta en su mazo si su identidad es uno de los dos, y no puede jugarla salvo que ambos personajes estén en juego con su cara de héroe (una identidad de alter ego no cuenta).",
  },
  amplify: {
    name: "Amplificación",
    definition:
      "Cada icono de Amplificación en juego añade un icono de Aumento extra a cada carta de Aumento que se pone boca arriba durante la activación de un enemigo, mientras el icono siga en juego.",
  },
  hinder: {
    name: "Complicación X",
    definition:
      "Una carta con Complicación X entra en juego con X de Amenaza ya encima, además de la Amenaza inicial que tuviera. Una carta que no es un plan, como una obligación, simplemente lleva esa Amenaza sobre sí misma.",
  },
  patrol: {
    name: "Patrulla",
    definition:
      "Mientras haya un esbirro con esta palabra clave enfrentado a ti, ninguna de tus cartas puede intervenir en el plan principal.",
  },
  stalwart: {
    name: "Firmeza",
    definition:
      "Un personaje con esta palabra clave nunca puede quedar aturdido ni confundido: al ganarla pierde las cartas de Estado «Aturdido» o «Confundido» que ya tuviera, y no puede recibir otras nuevas.",
  },
  victory: {
    name: "Victoria X",
    definition:
      "Cuando una carta con Victoria X va a salir del juego porque la derrotan (o, si tiene Usos, porque se queda sin contadores), va a la zona de victoria compartida en vez de a una pila de descartes, y allí vale X puntos de victoria.",
  },
  alliance: {
    name: "Alianza",
    definition:
      "Cualquier jugador puede ayudar a pagar el coste de una carta con esta palabra clave una vez que su controlador anuncia que la juega, aunque solo ese controlador cuenta como quien la ha jugado.",
  },
  steady: {
    name: "Tesón",
    definition:
      "Un personaje con esta palabra clave puede tener una segunda carta de Estado «Aturdido» y una segunda «Confundido». No queda aturdido ni confundido de verdad (ni se anula su ataque, plan o intervención) hasta que tiene dos del mismo tipo a la vez.",
  },
  requirement: {
    name: "Requisito (recursos)",
    definition:
      "Una carta con esta palabra clave solo puede jugarse gastando de verdad el tipo o los tipos de recurso que indica como parte de su coste; ni una carta que permite ignorar su coste en recursos se salta esto.",
  },
  temporary: {
    name: "Temporal",
    definition: "Una carta con esta palabra clave se descarta automáticamente del juego al final de la ronda.",
  },
  teamwork: {
    name: "Trabajo en equipo (rasgo)",
    definition:
      "Cuando un esbirro con esta palabra clave entra en juego y se enfrenta a un jugador, si ya hay en juego otro esbirro con el rasgo indicado, el recién llegado se activa contra ese mismo jugador. Si el esbirro se está mostrando, esto ocurre después de su «Cuando se muestre esta carta», como el Ataque veloz.",
    note: "Aquí la activación de Trabajo en equipo llega después del «Cuando se muestre esta carta» del esbirro (reglas, p. 43), igual que el ataque de Ataque veloz.",
  },
  assault: {
    name: "Asalto",
    definition:
      "Un personaje que hace una intervención básica contra un plan con esta palabra clave usa su ATQ en vez de su INT para esa intervención.",
  },
  find: {
    name: "Encontrar",
    definition:
      "Una instrucción para buscar una carta concreta en todas las zonas de la partida donde pueda estar (zonas de juego, mazos, pilas de descartes, cartas apartadas, etc.); no alcanza cartas boca abajo en juego ni la zona de victoria, ni una colección fuera de la partida.",
  },
  vulnerable: {
    name: "Vulnerable",
    definition:
      "Un personaje con esta palabra clave se descarta en cuanto queda aturdido o confundido, en vez de recibir la carta de Estado, y ese descarte no cuenta como derrotarlo.",
  },
  discount: {
    name: "Descuento X (rasgo)",
    definition:
      "Cuando juegas esta carta, cuesta X menos si tu identidad tiene el rasgo indicado. Si indica más de un rasgo, basta con tener uno, y la reducción se aplica solo una vez.",
  },
  linked: {
    name: "Enlazada (título de carta)",
    definition:
      "Un jugador nunca puede añadir a un mazo las cartas enlazadas a otra carta. Solo se apartan durante la preparación, un juego por cada mazo que incluya la carta indicada que las trae, y nunca cuentan para el tamaño del mazo.",
  },
  prerequisite: {
    name: "Requiere (identidad o rasgo)",
    definition:
      "Solo puede usar esta carta un jugador cuya identidad sea la indicada o tenga uno de los rasgos indicados.",
  },
  starting: {
    name: "Mano inicial",
    definition: "Antes de robar tu mano inicial, puedes sacar esta carta de tu mazo y ponerla directamente en tu mano.",
  },
  form: {
    name: "Identidad de [tipo]",
    definition:
      "Una carta con esta palabra clave («Identidad de energía.», «Identidad de masa.») da a tu identidad una identidad más, además de la de héroe y la de alter ego, mientras está boca arriba. Cambiarla no gasta tu cambio de identidad de la ronda, pero sí cuenta como cambiar de identidad para los efectos de las cartas.",
  },

  // Status cards.
  confused: {
    name: "Confundido",
    definition:
      "Anula el siguiente intento de plan o de intervención del personaje: en vez de hacerlo, se descarta la carta «Confundido» (el coste ya pagado para intentarlo, como agotar al personaje, sigue pagado).",
  },
  stunned: {
    name: "Aturdido",
    definition:
      "Anula el siguiente intento de ataque del personaje: en vez de atacar, se descarta la carta «Aturdido» (el coste ya pagado para intentarlo sigue pagado, y la carta sigue contando como jugada).",
  },
  tough: {
    name: "Duro",
    definition:
      "Evita todo el daño la próxima vez que un personaje con este estado vaya a sufrir daño: el daño se evita por completo y se descarta una carta «Duro», en vez de reducir el daño. Un personaje tiene una salvo que una carta diga otra cosa (Coloso tiene dos) y pierde solo una por golpe.",
  },

  // Basic concepts.
  threat: {
    name: "Amenaza",
    definition:
      "La Amenaza es lo que se acumula en el plan principal y en los planes secundarios a medida que pasan las fases del villano. Si la Amenaza del plan principal llega a su objetivo, el villano gana la partida.",
  },
  mainScheme: {
    name: "Plan principal",
    definition:
      "El plan principal es el plan general del villano en el escenario. Gana Amenaza automáticamente en cada fase del villano, y los héroes pueden intervenir para quitársela y ganar tiempo.",
  },
  sideScheme: {
    name: "Plan secundario",
    definition:
      "Un plan secundario es un objetivo extra que aparece junto al plan principal con su propia Amenaza inicial. No tienes por qué eliminarlo, pero dejarlo estar suele salir caro.",
  },
  acceleration: {
    name: "Aceleración",
    definition:
      "La Aceleración es la Amenaza extra que se coloca en el plan principal en cada fase del villano, además de su ritmo impreso, por los iconos y fichas de Aceleración en juego.",
  },
  thwart: {
    name: "Intervención",
    definition:
      "Intervenir es el atributo básico de un héroe o aliado para quitar Amenaza de un plan. Cuesta agotar al personaje, y quita tanta Amenaza como su INT.",
  },
  attack: {
    name: "Ataque",
    definition:
      "Atacar es el atributo básico de un héroe o aliado para infligir daño a un enemigo. Cuesta agotar al personaje, e inflige tanto daño como su ATQ.",
  },
  resource: {
    name: "Recurso",
    definition:
      "Los recursos pagan las cartas que juegas. Los generas descartando una carta de tu mano por sus iconos de recurso impresos, o con la capacidad de Recurso de una carta.",
  },
  cost: {
    name: "Coste",
    definition:
      "Un coste es lo que tienes que pagar antes de que ocurra el efecto de una carta o capacidad: normalmente recursos para jugar una carta, pero a veces otra cosa, como agotar una carta.",
  },
  heroAlterEgoForm: {
    name: "Identidad de héroe / identidad de alter ego",
    definition:
      "Toda identidad está en una de sus dos caras, según qué lado de la carta de identidad esté boca arriba. Cada cara tiene sus propias cartas y atributos, y puedes cambiar de una a otra una vez por turno.",
  },
  flip: {
    name: "Dar la vuelta",
    definition:
      "Dar la vuelta a una carta es girarla para mostrar su otra cara; lo más habitual es que tu carta de identidad cambie de identidad, pero cualquier carta de dos caras funciona igual.",
  },
  recover: {
    name: "Recuperación",
    definition:
      "Recuperarse es el atributo básico de tu alter ego para curar daño. Cuesta agotar a tu alter ego, y cura tanta Vida como su REC.",
  },
  exhaustCost: {
    name: "Agotar (como coste)",
    definition:
      "Muchos atributos básicos y capacidades se pagan agotando la carta que los usa, girándola 90 grados. No puede volver a hacerlo hasta que algo la prepare.",
  },
  defend: {
    name: "Defender",
    definition:
      "Defender pone a un héroe o aliado entre el ataque de un enemigo y su objetivo real, así que el defensor sufre el daño en su lugar (reducido por su DEF, en la defensa básica de un héroe).",
  },
  consequentialDamage: {
    name: "Daño derivado",
    definition:
      "El daño derivado es el daño que un aliado sufre automáticamente justo después de atacar o intervenir, indicado con pequeños iconos bajo su ATQ o INT impresos.",
  },
  encounterCard: {
    name: "Carta de Encuentro",
    definition:
      "Las cartas de Encuentro son las cartas del bando del villano (esbirros, perfidias, planes secundarios y demás) que se reparten y se muestran desde el mazo de Encuentros para poner difícil el turno a los héroes.",
  },
  boost: {
    name: "Aumento",
    definition:
      "Una carta de Aumento se reparte boca abajo al villano cuando ataca o ejecuta su plan, y se pone boca arriba durante esa activación para sumar sus iconos (y a veces su propio efecto) al total. Los esbirros nunca reciben cartas de Aumento.",
  },
  villainPhase: {
    name: "Fase del villano",
    definition:
      "La fase del villano es la parte de la ronda en la que el plan principal gana Amenaza, el villano y sus esbirros se activan, y a cada jugador se le reparten cartas de Encuentro que mostrar.",
  },
  heroPhase: {
    name: "Fase de los jugadores",
    definition:
      "La fase de los jugadores (o de los héroes) es la parte de la ronda en la que cada jugador, por orden de turno, juega cartas y usa los atributos de su identidad y de sus aliados.",
  },
  ally: {
    name: "Aliado",
    definition:
      "Un aliado es un amigo o compañero que pones en juego para luchar a tu lado. Ataca, interviene o defiende agotándose, igual que tu propio héroe.",
  },
  aspect: {
    name: "Aspecto",
    definition:
      "Un aspecto (Agresividad, Justicia, Liderazgo, Protección o Masacrismo) es la línea de construcción que eliges para un mazo: te abre las cartas de ese aspecto para completar las de tu héroe.",
  },
  handSize: {
    name: "Tamaño de la mano",
    definition:
      "El tamaño de la mano es cuántas cartas debes tener al final de la fase de los jugadores: roba hasta llegar a él, o descarta hasta bajar a él, antes de que avance la ronda.",
  },
  mulligan: {
    name: "Renovar la mano (mulligan)",
    definition:
      "Renovar la mano es una segunda oportunidad única para tu mano inicial: al empezar la partida puedes descartar las cartas que quieras de las que te tocaron y robar otras tantas nuevas.",
  },
  energyResource: {
    name: "Recurso de Energía",
    definition:
      "Uno de los cuatro tipos de recurso. Un icono de Energía genera un recurso de Energía al gastarlo, que sirve para cualquier coste salvo que algo pida un tipo concreto.",
  },
  mentalResource: {
    name: "Recurso Mental",
    definition:
      "Uno de los cuatro tipos de recurso. Un icono Mental genera un recurso Mental al gastarlo, que sirve para cualquier coste salvo que algo pida un tipo concreto.",
  },
  physicalResource: {
    name: "Recurso Físico",
    definition:
      "Uno de los cuatro tipos de recurso. Un icono Físico genera un recurso Físico al gastarlo, que sirve para cualquier coste salvo que algo pida un tipo concreto.",
  },
  wildResource: {
    name: "Recurso Universal",
    definition:
      "Uno de los cuatro tipos de recurso. Un icono Universal genera un recurso que asignas como Energía, Mental, Físico o Universal al gastarlo: el único tipo que cuenta como todos los demás a la vez.",
  },

  // Mutant Genesis and MojoMania.
  labeledAbility: {
    name: "Etiquetas (ataque), (intervención) y (defensa)",
    definition:
      "Una etiqueta tras el momento de una capacidad, como Acción de Héroe (intervención), hace que usarla sea una intervención, un ataque o una defensa reales de tu identidad. La Patrulla y la Crisis pueden impedirla, y las cartas que reaccionan a que intervengas o ataques la tienen en cuenta.",
  },
  counters: {
    name: "Contadores (acero, poder, carga, imán, audiencia)",
    definition:
      "Las cartas crean sus propios contadores, y cada uno es un contador genérico normal que se queda en la carta que lo nombra. Un coste que quita contadores solo puede pagarse si hay suficientes, y los contadores de una carta se pierden cuando sale del juego. Los contadores de un plan principal vuelven a la reserva cuando avanza; las fichas de Aceleración se quedan.",
  },
  unusualCosts: {
    name: "Costes de daño y costes «hasta»",
    definition:
      "Sufrir daño como coste solo cuenta como pagado si lo sufres entero, así que una carta «Duro» o una prevención detienen las Garras de Lobezno. Un coste de «hasta N» o «cualquier cantidad» necesita al menos uno, así que Gambito no puede usar Arrojar el naipe sin contadores.",
  },
  encounterDeckEmpty: {
    name: "Se acaba el mazo de Encuentros",
    definition:
      "Cuando el mazo de Encuentros se vacía, su pila de descartes se baraja para formar un mazo nuevo y se coloca una ficha de Aceleración junto al plan principal. Si el mazo y la pila de descartes están vacíos a la vez, los jugadores pierden.",
  },
  weatherDeck: {
    name: "El mazo de Clima de Tormenta",
    definition:
      "Tormenta guarda sus cuatro apoyos de Clima en un mazo boca abajo junto a su identidad, sin pila de descartes. Control del clima cambia el Clima en juego por uno que elijas de ese mazo y luego resuelve el Especial del nuevo. Un Especial solo se resuelve cuando otra capacidad lo indica.",
  },
  touched: {
    name: "Contacto físico",
    definition:
      "La mejora Contacto físico de Pícara se vincula a otro personaje con Tocar la piel o Transferencia de energía. Mientras siga allí, Pícara tiene los rasgos de ese personaje, y recibe una bonificación distinta según sea un esbirro, un villano, un aliado o un héroe. Una mejora sobre la carta de otro jugador la controla ese jugador.",
  },
  tacticUpgrades: {
    name: "Cíclope: mejoras de Táctica",
    definition:
      "Las mejoras de Táctica de Cíclope se vinculan a enemigos. Aprovechar una debilidad, Defensa practicada y Objetivo prioritario son Temporales, así que se descartan al final de la ronda. Dotes de mando mantiene en juego las que están sobre esbirros, y te da el primer turno de la fase de los jugadores.",
  },
  phoenixForce: {
    name: "Fuerza Fénix",
    definition:
      "La Fuerza Fénix es una mejora permanente. Empieza CONTENIDA con 4 contadores de poder; quitar el último le da la vuelta a DESATADA (+2 ATQ, -2 INT). Colocarle contadores hasta que tenga 4 o más la devuelve a su otra cara. Muchas cartas de Fénix miran qué rasgo tienes.",
  },
  robertKelly: {
    name: "Robert Kelly (Dientes de Sable)",
    definition:
      "Robert Kelly empieza vinculado a Busca al Senador, sin que nadie lo controle. Derrota ese plan secundario y el jugador inicial toma el control de él; desde entonces sufre el daño de cualquier ataque enemigo no defendido contra ese jugador. Si sale del juego, los jugadores pierden.",
  },
  wideawake: {
    name: "Cautivos y Operación Tolerancia Cero",
    definition:
      "Project Wideawake aparta sus aliados Cautivos. Derrotar Protocolos de captura pone uno al azar en juego bajo tu control. Operación Tolerancia Cero guarda boca abajo los aliados que derrotan los ataques enemigos; cuando tiene 3 cartas más que jugadores, los jugadores pierden.",
  },
  mansionAttack: {
    name: "Ataque a la mansión",
    definition:
      "Ataque a la mansión tiene cuatro villanos, pero solo hay uno en juego a la vez, en orden aleatorio. Derrotar a uno muestra el siguiente, y derrotar a suficientes (depende de la dificultad) da la victoria. Sus etapas de plan principal también se barajan: tres planes principales en la zona de victoria hacen perder la partida, y la primera etapa cuenta como uno.",
  },
  futurePast: {
    name: "El mazo del Futuro pasado",
    definition:
      "En el escenario Futuro pasado de la campaña, cada plan secundario que derrotas baraja la primera carta del mazo del Futuro pasado en el mazo de Encuentros y luego se da la vuelta a su otra cara, que suele ayudarte, como la Metro P.D. o Magneto como aliado.",
  },
  campaignRoles: {
    name: "Papeles de campaña",
    definition:
      "En la campaña de Génesis Mutante cada jugador elige un papel distinto: Luchador, Comandante, Defensor o Pacificador. Cada papel trae cinco mejoras de un solo uso. Usar una la retira de la partida y de la reserva de la campaña para siempre.",
  },
  threatOnCharacters: {
    name: "Amenaza sobre personajes",
    definition:
      "En MojoMania, la Amenaza puede estar sobre un personaje en vez de sobre un plan. No es Amenaza de un plan: cuando ese personaje se da la vuelta o sale del juego, toda su Amenaza pasa al plan principal.",
  },
  showDeck: {
    name: "Entornos SERIE y el mazo de series",
    definition:
      "Una SERIE es un entorno de un conjunto de género, y mostrar una descarta los demás entornos UBICACIÓN. Las SERIES extra de Espiral forman el mazo de series: sin pila de descartes, y los efectos de las cartas de jugador no pueden tocarlo. Una SERIE descartada va al fondo de ese mazo.",
  },
  wheelOfGenres: {
    name: "Ruleta de géneros",
    definition:
      "GIRANDO espera a que el mazo de Encuentros se reinicie y entonces se da la vuelta (o los jugadores pierden si no quedan conjuntos modulares apartados). DETENIDA actúa al principio del paso 3 de la fase del villano: muestra la SERIE de un conjunto apartado al azar, pone el resto sobre el mazo, reparte 2 cartas y vuelve a darse la vuelta.",
  },
  ratingsCounters: {
    name: "Contadores de audiencia (MaGog)",
    definition:
      "El campeón y Los aspirantes reúnen contadores de audiencia. Cada uno se da la vuelta al llegar a 5 por héroe y conserva sus contadores. Con 10 por héroe en Los aspirantes, los jugadores ganan; con 10 en El campeón, pierden. Algunas cartas dependen de qué público tiene más.",
  },
  longshot: {
    name: "Longshot",
    definition:
      "Longshot es un aliado con dorso de carta de Encuentro, así que se reparte y se muestra como una carta de Encuentro. Al mostrarse se une al jugador que lo mostró y la carta tiene Oleada. Sus ataques ganan Penetrante, y no cuenta para tu límite de aliados.",
  },
  removedFromCampaign: {
    name: "Retirada de la campaña",
    definition:
      "Una carta retirada de la campaña se tacha del registro de campaña y no puede volver a usarse en lo que queda de esa campaña. Sigue fuera aunque pierdas el escenario en el que se retiró y lo vuelvas a intentar. El juego la saca de tu mazo por ti; si tu mazo se queda corto, añade una carta.",
  },

  // NeXt Evolution.
  playerSideScheme: {
    name: "Planes secundarios de jugador y su límite",
    definition:
      "Un plan secundario de jugador se juega desde tu mano durante tu turno y se coloca junto al plan principal con Amenaza encima. Los héroes y aliados intervienen en él como en cualquier plan secundario. Con 1 o 2 jugadores solo puede haber uno en juego (2 con 3 o 4 jugadores): jugar otro descarta uno, y ese descarte no es una derrota.",
  },
  perPlayerCost: {
    name: "Costes por jugador",
    definition:
      "Un icono de por jugador junto a un coste impreso lo multiplica por el número de jugadores que empezaron la partida. En una partida de 2 jugadores, un coste de 2 por jugador es 4, y los efectos que leen el coste impreso ven 4.",
  },
  poolAspect: {
    name: "El aspecto Masacrismo y el conjunto Malsacre",
    definition:
      "Masacrismo es el quinto aspecto, y cuenta como aspecto para cualquier carta que pida uno. Si al menos un jugador eligió Masacrismo como aspecto, Crisis de Masacres infinitos se añade al mazo de Encuentros. Incluir sin más cartas de Masacrismo en otro aspecto no lo añade.",
  },
  specialists: {
    name: "Especialistas (X-23)",
    definition:
      "Entrenamiento especializado, un plan secundario de jugador, pone en juego una mejora Especialista al ser derrotado. Los Especialistas son cartas enlazadas que se apartan al empezar la partida, fuera de cualquier mazo. Quien toma el control de una pasa a ser su propietario.",
  },
  threeFaceIdentity: {
    name: "Identidades de tres caras (Ángel)",
    definition:
      "La identidad de Ángel se pliega en tres caras: alter ego, Ángel y Arcángel. Cambiar entre dos cualesquiera es un cambio de identidad, y un cambio voluntario entre las caras de héroe gasta tu cambio de la ronda. Las cartas que nombran una cara (identidad de Arcángel) leen la cara visible.",
  },
  psiBlades: {
    name: "Cuchillo psiónico y Katana psiónica",
    definition:
      "Los dos Cuchillos psiónicos de Mariposa Mental son permanentes, así que nunca están en su mazo. Cada uno tiene dos caras: Control de energía psiónica le da la vuelta a uno cuando usas un atributo básico, y la cara de Katana psiónica añade +1 ATQ y Penetrante a un ataque básico, pero es restringida.",
  },
  hopeSummers: {
    name: "Hope Summers",
    definition:
      "Hope Summers es un aliado que controla el jugador inicial, y se mueve con el indicador de jugador inicial. Tiene el ATQ y la INT de tu héroe, no cuenta para tu límite de aliados, y si sale del juego los jugadores pierden.",
  },
  actionsOtherTurns: {
    name: "Acciones en el turno de otro jugador",
    definition:
      "Durante el turno de otro jugador puedes usar cualquier capacidad de Acción que podrías usar en tu propio turno, incluido un evento de Acción de tu mano. Usa tus propios recursos, tu identidad y tus límites. No te permite atacar, intervenir, cambiar de identidad ni jugar aliados, apoyos o mejoras.",
  },
  routed: {
    name: "Vencidos (villanos debajo)",
    definition:
      "Cada vez que se derrota al villano, va boca arriba debajo de Vencidos, fuera del juego, y entra el siguiente villano. Tres villanos debajo de Vencidos dan la victoria. En la cara Experto, el villano gana Represalia 1 por cada carta debajo.",
  },
  setupAttachments: {
    name: "Accesorios de Inicio (Vuelo, Superfuerza, Telepatía)",
    definition:
      "En algunos escenarios el villano empieza con un accesorio de Superpoder ya vinculado, puesto en juego por su palabra clave Inicio. El escenario de Mister Siniestro aparta los tres conjuntos, así que allí la palabra clave se ignora y cada conjunto se une al mazo de Encuentros cuando se muestra su etapa.",
  },

  // Age of Apocalypse.
  energyAbsorption: {
    name: "Absorción de energía (Bishop)",
    definition:
      "Después de que Bishop sufra daño de un ataque, descarta tantas cartas de la parte superior de tu mazo. Cada carta de recurso descartada así va a tu mano; el resto se queda en la pila de descartes. Recibir golpes es como su mazo alimenta su mano, así que sus mejoras y eventos miran las cartas de recurso que tienes.",
  },
  paidWith: {
    name: "Cartas que miran cómo pagaste",
    definition:
      "Algunas cartas miran con qué se pagaron: los eventos de Bishop buscan una carta de recurso, y los de Júbilo cuentan tipos de recurso distintos. Aclaración para este juego: los recursos gastados por encima del coste no pagaron, así que no añaden tipos. El juego pregunta qué cuenta un Universal solo cuando la elección cambia el resultado. Las cartas antiguas de «si pagaste con» leen todo lo gastado.",
  },
  faceupTopCard: {
    name: "La primera carta boca arriba de Magik",
    definition:
      "En identidad de héroe, la primera carta del mazo de Magik está boca arriba. Una vez por fase puedes jugarla como si estuviera en tu mano, por 1 menos. Sus mejoras y eventos leen el icono de recurso de esa carta: un icono Universal cuenta como todos los tipos. Cuando cambia la primera carta, cambia lo que dan.",
  },
  limbo: {
    name: "Limbo y los hechizos de Illyana",
    definition:
      "Limbo cambia una carta de tu mano por la primera de tu mazo, así que eliges cuál será la carta boca arriba de Magik. La interrupción de Illyana pone un HECHIZO de tu pila de descartes encima de tu mazo cuando cambias a tu identidad de héroe. Se resuelve antes del cambio, y solo una vez por fase.",
  },
  frostbite: {
    name: "Congelación y «¡Congélate!» (Hombre de Hielo)",
    definition:
      "El Hombre de Hielo empieza con seis mejoras Congelación apartadas. «¡Congélate!» vincula una a un enemigo cuando hace un ataque o una defensa básicos contra él. Congelación da -1 PLA y -1 ATQ, y vuelve a la pila de apartadas cuando su anfitrión se activa o sale del juego. Un enemigo con Congelación tiene una mejora vinculada, que es lo que necesita ¡Chúpate ésa!.",
  },
  jubileeVersions: {
    name: "Las cartas con letra de Júbilo",
    definition:
      "Polvorilla, Estallido de Luz y Plasmoides de Energía tienen tres versiones cada una, a, b y c, que solo se diferencian en el icono de recurso. Su mazo lleva una de cada versión. Comparten título, así que un recuento o una búsqueda por título ve las tres.",
  },
  grounded: {
    name: "Castigada (Júbilo)",
    definition:
      "Castigada hace que cambiar a tu identidad de héroe durante tu turno cueste 2 recursos del mismo tipo. Cuando se muestra, cambias a tu identidad de alter ego. Jugar un evento de Júbilo la retira del juego. Es su obligación, y se baraja en el mazo de Encuentros. Aclaración para este juego: la Acción de una carta de Encuentro que la cambia a su identidad de héroe en su turno también paga el coste.",
  },
  cellPhone: {
    name: "Teléfono móvil",
    definition:
      "Teléfono móvil tiene 3 contadores de carga. Gasta uno y agótalo para elegir a un jugador, que hace un ataque o una intervención básicos con un personaje que controle. Ese personaje recibe +1 INT y +1 ATQ para ese uso.",
  },
  bamf: {
    name: "¡Bamf! (Rondador Nocturno)",
    definition:
      "¡Bamf! se vincula a un enemigo, uno por enemigo. Cuando ese enemigo ataca, descártalo para que Rondador Nocturno sea el defensor sin agotarse. Un defensor que declara un efecto hace una defensa básica. Otras cartas descartan ¡Bamf! de un enemigo o de tu mano, y Teleportación rápida recupera copias.",
  },
  magneticPull: {
    name: "Atracción magnética (Magneto)",
    definition:
      "Una vez por ronda, descarta cartas de la parte superior de tu mazo hasta descartar una carta MAGNÉTICO y añádela a tu mano. Otras cartas leen el resultado: Armadura de Magneto mira qué iconos de recurso se descartaron, y Viejas desavenencias cuenta cuántas cartas fueron.",
  },
  magneticBubble: {
    name: "Burbuja Magnética",
    definition:
      "El daño que vayas a sufrir se coloca sobre Burbuja Magnética en vez de sobre ti. Cuando tiene 6 o más de daño encima, se descarta. Magneto tiene Represalia 1 mientras está en juego.",
  },
  wrappedInMetal: {
    name: "Envoltura metálica",
    definition:
      "Solo en identidad de héroe. Vincúlala a un esbirro que no sea ÉLITE: el esbirro no puede activarse, y su recuadro de texto impreso se considera en blanco. Proyectil Magnético descarta un esbirro con Envoltura metálica vinculada para infligir 5 de daño a un enemigo y aturdirlo.",
  },
  attackAbilityOne: {
    name: "Las capacidades (ataque) son un solo ataque",
    definition:
      "Una capacidad con la etiqueta (ataque) es un solo ataque, tenga o no ATQ, y toda carta así empieza a atacar cuando la capacidad empieza a resolverse. Todo su daño a enemigos es daño de ataque. La Represalia responde una vez por enemigo atacado, después de toda la capacidad. Un «Aturdido» que el atacante ya tuviera la anula; uno recibido después de empezar no (decisión del propietario). Una bonificación de ataque se aplica a cada instancia de daño, no al daño «adicional».",
  },
  attackTargets: {
    name: "A quién apunta un ataque",
    definition:
      "Cada enemigo al que apunta una capacidad de ataque cuenta como atacado, y la Guardia se comprueba para cada uno cuando va a ser atacado. Un enemigo que solo sufre daño incidental, como el daño de Brutalidad que llega al villano, no ha sido atacado: ni se comprueba la Guardia ni hay Represalia.",
  },
  basicPowerStat: {
    name: "Qué atributo alimenta un atributo básico",
    definition:
      "Cuando un efecto permite que una intervención básica use ATQ, el juego indica el atributo que la alimenta de verdad. Una carta que suma el atributo correspondiente del aliado, como «¡Tú puedes!», suma el atributo usado: ATQ para una intervención alimentada por ATQ.",
  },
  effectDefender: {
    name: "Defensores que declara un efecto",
    definition:
      "Cuando una capacidad declara a un héroe como defensor, como hace ¡Bamf!, ese héroe hace una defensa básica, así que las respuestas a una defensa básica se le aplican. Un aliado declarado defensor no usa ningún atributo básico: los aliados no tienen DEF. Jugar un evento con la etiqueta (defensa) no es por sí solo una defensa básica.",
  },
  mainSchemeBSide: {
    name: "La cara B de un plan principal antes de girarse",
    definition:
      "Mientras un plan principal muestra su cara A, su cara B no está activa: sus capacidades no pueden aplicarse. Empiezan a aplicarse cuando el plan pasa a la cara B, y no se aplican con efecto retroactivo a algo que ya ocurrió.",
  },
  hitPointBonusEnds: {
    name: "Una bonificación de Vida que termina",
    definition:
      "Si una bonificación como el +1 de Vida de Medidas desesperadas deja de aplicarse y deja a un aliado o esbirro con tanto daño como su Vida o más, ese personaje queda derrotado.",
  },
  villainsFallTogether: {
    name: "Villanos derrotados a la vez",
    definition:
      "Los villanos que caen al mismo tiempo se derrotan en un solo paso, no uno tras otro. Un Jinete no puede ser derrotado mientras otro villano tenga al menos 1 de Vida, así que los últimos Jinetes pueden caer juntos.",
  },
  genePool: {
    name: "Acervo genético (Unus)",
    definition:
      "Acervo genético es un plan secundario permanente en juego desde la preparación. Cuanta más Amenaza tiene, más fuerte se vuelve Unus: con 3 gana Represalia 1, con 6 Firmeza, con 9 un icono de Amplificación. El plan principal le añade 1 en cada fase del villano, y un aliado derrotado por cualquier cosa que no sea daño derivado le añade 3.",
  },
  modularDifficulty: {
    name: "Infinites: dificultad modular",
    definition:
      "Con el conjunto Infinites, los jugadores pueden poner Amenaza extra en Acervo genético durante la preparación para hacer más difícil el escenario. El reglamento solo recomienda cantidades. El juego lo ofrece como opción de preparación, desactivada salvo que la actives.",
  },
  fourHorsemen: {
    name: "Los Cuatro jinetes",
    definition:
      "Cuatro villanos se colocan en fila, y el contador activo marca cuál actúa. Después de que un villano se active, el contador pasa al siguiente. Un Jinete no puede ser derrotado mientras otro villano tenga al menos 1 de Vida. Caballo dorado y Alas de Metal hacen que su villano cuente como si tuviera al menos 1.",
  },
  horsemenSetup: {
    name: "Caras y planes secundarios de los Jinetes",
    definition:
      "Cada Jinete tiene una cara A y una cara B, y la preparación elige una para cada uno. La dificultad fija la predeterminada y puedes cambiar cualquiera. Cada jugador muestra además un plan secundario al azar del conjunto de los Cuatro jinetes. Peste deja en blanco el recuadro de texto de tu identidad, salvo los rasgos, hasta la siguiente fase del villano.",
  },
  prelates: {
    name: "Apocalipsis: Prelados y planes encadenados",
    definition:
      "El escenario de Apocalipsis encadena planes secundarios: El corazón del imperio, luego The Towering Citadel y luego El trono del tirano. No puede quitárseles Amenaza mientras haya en juego un esbirro Prelado. Derrotar uno muestra un Prelado apartado al azar y reparte una carta de Encuentro a cada otro jugador.",
  },
  apocalypseDefeat: {
    name: "Apocalipsis: «va a ser derrotado; en su lugar»",
    definition:
      "Cuando Apocalipsis va a ser derrotado, en su lugar descarta sus accesorios y cura todo su daño, y el plan principal pierde tanta Amenaza como el número de su Vida impresa. Un plan principal completado trae su siguiente etapa. El último plan secundario se da la vuelta a No Longer Worthy, y entonces derrotarlo da la victoria.",
  },
  settingEnvironments: {
    name: "Bestia Oscura: entornos Ubicación",
    definition:
      "Bestia Oscura muestra un entorno Ubicación apartado al azar. Ninguna regla limita el juego a uno, así que puede haber varios en juego, y el jugador que resuelve elige a cuál se refiere una carta. Cada uno tiene un Especial, y Bestia Oscura resuelve el Especial de una Ubicación cuando te ataca. Una carta también puede pedirte resolver el Especial como coste. Aclaración para este juego: una Ubicación sigue en juego cuando se muestra otra.",
  },
  enSabahNur: {
    name: "En Sabah Nur: identidades y contadores de poder",
    definition:
      "Apocalipsis cambia de identidad a lo largo de tres etapas: Biomorfo, Ciberpata y Gigante. En cada fase del villano la pirámide gana un contador de poder. Con 4, el jugador inicial los quita y descarta cartas de Encuentro hasta descartar una carta de Superpoder, y luego la muestra.",
  },
  pursuedByThePast: {
    name: "Normal III: Perseguido por el pasado",
    definition:
      "Normal III sustituye Una sombra del pasado por este entorno permanente, en juego desde la preparación. Las cartas del conjunto añaden contadores de persecución. Con 3 contadores más que jugadores se quitan: tu esbirro archienemigo se activa o, si no está en juego, entra el conjunto de archienemigo y la carta se da la vuelta.",
  },
  crazyGang: {
    name: "La Banda Loca (Rondador Nocturno)",
    definition:
      "Después de que un esbirro que no sea Élite ejecute su plan contra un jugador, ese esbirro se le reparte al jugador como carta de Encuentro boca abajo. Con más de un jugador, esa carta boca abajo pasa luego al siguiente jugador.",
  },
  celestialTech: {
    name: "Tecnología Celestial",
    definition:
      "Armadura Celestial y Arma Celestial se vinculan al villano. Cuando el villano ejecuta su plan o te ataca, descartas la primera carta de tu mazo y lees su recurso: Energía, Mental y Físico hacen una cosa cada uno, y Universal hace todas.",
  },
  arcadeTraps: {
    name: "Arcade y los planes secundarios ¡Trampa!",
    definition:
      "Arcade no puede sufrir daño mientras haya en juego un plan secundario ¡Trampa!. Cada plan secundario ¡Trampa! castiga al jugador que lo derrota: daño, un aturdimiento o una confusión. Trampa elaborada resuelve esos efectos como si los hubieras derrotado.",
  },

  // Agents of S.H.I.E.L.D.
  missionArea: {
    name: "La zona de misión",
    definition:
      "En las partidas de campaña, el plan secundario de misión y su Capataz están en la zona de misión: en juego, pero sin que ningún jugador los controle. Las capacidades no pueden alcanzarla salvo que la nombren, y los jugadores no pueden intervenir en el plan. El ataque básico de un héroe no puede apuntar a un enemigo de allí. Un aliado jugado allí tiene el recuadro de texto en blanco, salvo los rasgos.",
  },
  missionAttempt: {
    name: "Intentos de misión",
    definition:
      "Equipo para la misión hace un intento de misión: descarta de la parte superior de tu mazo tantas cartas como aliados haya en la misión y empareja cada una con un aliado distinto. Un aliado participa si su icono de recurso coincide con el de su carta (Universal coincide con cualquiera). El ATQ total es una reserva de daño para los enemigos de allí, y la INT total quita Amenaza.",
  },
  overseers: {
    name: "Capataces y Respuestas de misión",
    definition:
      "Un Capataz es un esbirro Élite en la zona de misión. No puede sufrir daño mientras haya otro esbirro en la misión, y la misión no puede ser derrotada mientras haya algún esbirro allí. Una Respuesta de misión es una Respuesta obligada que se resuelve después de que descartes cartas para un intento de misión.",
  },
  missionOutcomes: {
    name: "Después de una misión",
    definition:
      "Cuando se gana un escenario, el registro de campaña tacha el nombre de la misión y aplica su línea de Derrotada o No derrotada; un Capataz derrotado también se tacha. Un escenario perdido puede volver a intentarse, y el nuevo intento saca una misión y un Capataz nuevos de los que no están tachados.",
  },
  campaignRewards: {
    name: "Recompensas de campaña y tamaño del mazo",
    definition:
      "Una carta de recompensa de una misión derrotada no es una de las 40 cartas que necesita tu mazo, y sí es una de las 50 que puede tener: construye 40 cartas normales y luego añade la recompensa. Cada héroe debe elegir una recompensa, aunque sea de un título que su mazo ya tiene, y decide antes de cada partida si va en el mazo; los límites de copias habituales siguen aplicándose. Medidas desesperadas se baraja durante la preparación y no cuenta para ninguno de los dos límites.",
  },
  allySearch: {
    name: "Búsqueda de aliado de campaña y el Profesor X",
    definition:
      "En las partidas de campaña, la preparación hace que cada jugador busque un aliado en su mazo y lo añada a su mano, y cuenta para el tamaño de la mano. En el último escenario, Proteger al Profesor sustituye a la misión aleatoria, y el Profesor X no puede entrar en juego. Derrotar la misión gana la campaña; fallarla la pierde.",
  },
  shieldSupports: {
    name: "Los apoyos S.H.I.E.L.D. de María Hill",
    definition:
      "Todos los aliados que controla María Hill ganan el rasgo S.H.I.E.L.D. Su mazo puede llevar el máximo de copias de exactamente 3 apoyos S.H.I.E.L.D. de otros aspectos. Es todo o nada: 3 títulos, cada uno con su límite completo de copias, o ninguno. Su acción Reasignación, una vez por ronda, mueve 1 contador genérico de un apoyo a otro apoyo S.H.I.E.L.D.",
  },
  allPurposeCounters: {
    name: "Contadores genéricos",
    definition:
      "Un contador genérico es un contador sin más que toma el tipo de la carta sobre la que está. Cuando una carta coloca o mueve uno, pierde su tipo anterior y pasa a ser del tipo que define esa carta, como un contador de pájaro o de cerradura. Una carta que no define tipo tiene contadores genéricos sin más. Una carta que dice contador genérico puede usar cualquier contador, sea del tipo que sea.",
  },
  suitForm: {
    name: "La identidad de traje de Nick Furia",
    definition:
      "La mejora Asalto / Sigilo de Nick es permanente y le da una identidad de traje. Cambiarla no gasta tu cambio de identidad del turno, pero cuenta como cambio de identidad para los efectos de las cartas. La Amenaza se acumula sobre ella. Break Cover la pasa a Asalto cuando atacas, y Asalto puede gastar hasta 3 de Amenaza en ese mismo ataque. Infiltrate la pasa a Sigilo.",
  },
  stealthSuit: {
    name: "Sigilo",
    definition:
      "En identidad de héroe con Sigilo a la vista, cuando un enemigo va a atacar al propio Nick, en su lugar ejecuta su plan. Hasta 1 de Amenaza de ese plan va a la mejora Sigilo en vez de al plan principal, mientras tenga 5 o menos. Un enemigo aturdido o confundido pierde primero su carta de Estado y no se activa. Defender a otro jugador, o un ataque a su aliado, no lo activa.",
  },
  teamUpPairs: {
    name: "Parejas de Equipo de esta caja",
    definition:
      "Superespías nombra a María Hill y a Nick Furia: el mazo de cada héroe lleva al otro como aliado, así que la carta se juega cuando ambos están en juego. El corazón de la pantera, Periodismo de investigación, Supersoldados e Invierno, Viuda, soldado, espía siguen la misma idea con otras parejas. Un aliado cuenta si su título o subtítulo coincide. Las cartas de Equipo con Máximo de 1 por mazo permiten una copia en un mazo.",
  },
  tuckedCards: {
    name: "Cartas metidas debajo (Seda)",
    definition:
      "Una carta metida debajo está boca arriba bajo otra carta, sin estar en juego ni vinculada. Cuando esa carta sale del juego, se descartan las cartas metidas debajo. Seda tiene como máximo 4 cartas de Encuentro bajo su identidad. Sentido sedoso mete debajo un esbirro, plan secundario o perfidia que hayas resuelto, desde la pila de descartes de Encuentros. Cindy Moon descarta una para robar 2. La caza de la novia araña inflige 2 a tu identidad si una carta de jugador la descarta.",
  },
  encounterTopFaceup: {
    name: "La carta de Encuentro boca arriba de Halcón",
    definition:
      "En identidad de héroe, durante la fase de los jugadores, la primera carta del mazo de Encuentros está boca arriba para todos los jugadores. No se muestra y nada se activa. Vuelve a estar boca abajo en la fase del villano y en identidad de alter ego. Cuando se descarta, la siguiente se ve al momento. Ala Roja, Vista panorámica y Espolón de caza leen los iconos de su zona de Aumento.",
  },
  discardedIcons: {
    name: "Descartar por iconos de Aumento",
    definition:
      "Ala Roja y cartas parecidas descartan la primera carta del mazo de Encuentros y cuentan sus iconos: cuentan tanto las estrellas como los iconos de Aumento, y los iconos de Amplificación no suman nada. Una carta boca arriba sin iconos no tiene nada que dar, así que Ala Roja no puede empezar y Ave de presa y A vista de pájaro no ofrecen el descarte. Una carta boca abajo sí puede descartarse.",
  },
  falconDeckTricks: {
    name: "Cartas de Aumento y cartas repartidas (Halcón)",
    definition:
      "Salir volando mira una carta de Aumento recién dada a un enemigo que ataca y la primera carta del mazo de Encuentros. Puedes intercambiarlas, y luego roba 1 carta por cada icono impreso en la carta de Aumento. Reconocimiento Aéreo puede responder a que se reparta una carta de Encuentro a un jugador: quita un contador de reconocimiento en su lugar, y la carta no se reparte.",
  },
  linkedTakeover: {
    name: "Cartas enlazadas que tomas",
    definition:
      "Una carta enlazada nunca está en un mazo. Se aparta cuando un mazo tiene la carta que nombra. Redención está enlazada a Muestra de empatía y se une a un esbirro que llega a su Amenaza. El Escudo del Capitán América está enlazado a la mejora Capitán América. Halcón puede llevarse el escudo de Steve Rogers a la mano y jugarlo. Si se descarta, vuelve a la pila de descartes de Steve.",
  },
  shuriInventor: {
    name: "Inventora, de Shuri",
    definition:
      "Inventora agota a Shuri, busca en tu mazo una mejora Pantera Negra o Tecnología y la juega por 2 menos. Tú pagas el resto, y puedes usarla una vez por ronda. La búsqueda no es opcional. Si hay en tu mazo una mejora que cumple, te llevas una, y si no hay ninguna, la búsqueda falla.",
  },
  encasedInIce: {
    name: "Atrapado en hielo",
    definition:
      "Ventisca vincula Atrapado en hielo al personaje al que ataca. Ese personaje no puede atacar a otros enemigos que no sean la carta. Cualquier jugador puede atacarla como si fuera un esbirro: el daño cae sobre ella, y con 3 o más pasa el daño sobrante al personaje y se descarta. Se descarta, no se derrota. Si no hay copia que encontrar, Ventisca aturde al personaje en su lugar.",
  },
  maxPerPlayer: {
    name: "Máximo de 1 por jugador",
    definition:
      "Esto limita lo que puedes controlar, no solo lo que puedes jugar. Una carta que pone en juego una segunda copia para ti, como Invierno, Viuda, soldado, espía con Postura agresiva, no la mete mientras controles una. Máximo de 1 por mazo limita en cambio las copias de un mazo.",
  },
  afterYouAttack: {
    name: "«Después de que ataques» se refiere a tu identidad",
    definition:
      "Cuando una carta dice que atacaste, se refiere a tu identidad (o a un evento o recurso que jugaste), no a un aliado. El ataque de un aliado no responde a Espada de Ciudadano V ni a Traseúntes inocentes. La excepción es «después de que un enemigo te ataque»: eso se refiere a ti, aunque haya defendido un aliado.",
  },
  controlledMinions: {
    name: "Esbirros controlados",
    definition:
      "Controlador y Discos diabólicos, con Inocentes controlados en juego, ponen en juego boca abajo la primera carta de tu mazo como esbirro Controlado enfrentado a ti. Inocentes controlados da a cada uno 1 PLA, 1 ATQ y 1 de Vida. Cuando se derrota uno, la carta va a la pila de descartes de su propietario y se coloca 1 de Amenaza en el plan principal.",
  },
  surgeDealt: {
    name: "La Oleada reparte una carta boca abajo",
    definition:
      "La Oleada reparte al jugador que muestra la carta una carta de Encuentro boca abajo. Esa carta se reparte, no se muestra. Espera boca abajo hasta el paso de mostrar, y una Oleada fuera de la fase del villano también espera allí. Termina la primera carta y sus respuestas antes de mostrar la siguiente. Una respuesta a que te repartan una carta, como Datos de inteligencia, puede responderle. La Oleada puede anularse como un «Cuando se muestre esta carta».",
  },
  attackOnAlly: {
    name: "Ataques a aliados",
    definition:
      "Algunas cartas hacen que un enemigo ataque directamente a un aliado. El daño no defendido cae sobre ese aliado. Las capacidades de Aumento que dicen «tú» se refieren al controlador del aliado, y un héroe o aliado puede defender como siempre. La Brutalidad pasa a la identidad del controlador. Aclaración para este juego: las capacidades de «después de que un enemigo te ataque» sí responden, para ese controlador.",
  },
  preparationAbility: {
    name: "Capacidades de Preparación (Viuda Negra)",
    definition:
      "Las cartas de Viuda Negra imprimen Preparación donde iría una capacidad de Aumento, y no se resuelve como un Aumento. Cuando un héroe o aliado la ataca, ella quita 1 de Amenaza del plan principal. Si no se quitó ninguna, no pasa nada más. Si no, el atacante descarta la primera carta de Encuentro, resuelve su Preparación y luego se resuelve el ataque.",
  },
  nonScalingVillain: {
    name: "Villanos que se reinician",
    definition:
      "Batroc, MODOK y el Barón Zemo tienen Vida fija. Cuando van a ser derrotados, una Interrupción obligada da un beneficio a los jugadores y reinicia su Vida en su lugar. Para otras cartas no han sido derrotados. Las cartas de Estado y los accesorios se quedan. MODOK sin ninguna Celda de detención en juego es la excepción: los jugadores ganan.",
  },
  embassyCaptives: {
    name: "La embajada y los prisioneros",
    definition:
      "A Batroc no se le vence con daño. Avanzas por tres etapas de plan principal quitando toda la Amenaza. En la etapa 2, cada vez que su Amenaza llega a cero ganas un Prisionero liberado apartado, y luego reinicias la Amenaza a 3 por jugador para otro o avanzas. En la etapa 3, quita toda la Amenaza antes de que derroten a todos los prisioneros. Los Prisioneros liberados tienen Victoria -1 y no cuentan para tu límite de aliados.",
  },
  alertLevel: {
    name: "Nivel de alerta",
    definition:
      "Nivel de alerta es un entorno que acumula Amenaza. Después de que Batroc ataque, y después de que se derrote a cualquier personaje salvo por daño derivado, se le coloca 1 de Amenaza. Con 4 por jugador se vacía y se da la vuelta a Alto, donde Batroc recibe +1 PLA y +1 ATQ. Con 4 por jugador en Alto, pierdes. Gasta 1 recurso para quitar 1 de Amenaza. En una campaña empieza con la cantidad anotada en el escenario 1.",
  },
  holdingCell: {
    name: "El mazo de Celdas de detención",
    definition:
      "Cuatro Celdas de detención forman un mazo junto al plan principal. La de arriba está en juego con 2 contadores de cerradura por jugador. Gasta 2 de Energía o 3 recursos para quitar uno. Al quitar el último, se da la vuelta y su aliado Inhumano se une a cualquier jugador, y entra la siguiente celda. Un aliado liberado que sale del juego se da la vuelta y va al fondo de este mazo. MODOK pierde 2 contadores de cerradura cuando va a ser derrotado, o ganas si no hay ninguna celda en juego.",
  },
  thunderboltBackup: {
    name: "Un esbirro retenido por Thunderbolt Backup",
    definition:
      "Thunderbolt Backup retiene un esbirro Thunderbolt. Está en juego con sus fichas, cartas de Estado y accesorios, y puede ser atacado o elegido como objetivo, pero no está enfrentado a nadie y no se activa. Un jugador que ataca a un esbirro Thunderbolt queda enfrentado a él. Al terminar cada ronda, el esbirro con más daño queda retenido y se cura. El jugador inicial decide en caso de empate. Si el entorno sale del juego, el esbirro retenido se descarta.",
  },
  citizenV: {
    name: "Ciudadano V",
    definition:
      "Ciudadano V no puede ser derrotado hasta que haya al menos 1 por jugador esbirros Thunderbolt en la zona de victoria. Con 0 de Vida sigue en juego. En el paso dos de la fase del villano, si estás enfrentado a un esbirro Thunderbolt, no se activa contra ti y se cura 4 (6 en modo Experto). Un Ciudadano V aturdido o confundido gasta primero su carta de Estado.",
  },
  executiveBoard: {
    name: "La junta directiva",
    definition:
      "Tres entornos Miembro de la junta tienen contadores de secreto. Cada uno tiene una acción de héroe que quita uno a cambio de un beneficio. Con 4 contadores de secreto (3 en modo Experto) un miembro se da la vuelta y pasa a ser un accesorio del villano que te castiga cada vez que se le coloca un secreto. Si se dan la vuelta los tres, pierdes. Interferencia de I.M.A. añade secretos. En una campaña, los contadores se conservan y un miembro con la vuelta dada sigue siendo un accesorio.",
  },
  evidenceCards: {
    name: "Pruebas",
    definition:
      "Nueve cartas de prueba son medios, móvil u oportunidad, tres de cada. Una de cada se esconde en el sobre de I.M.A. y las otras seis van en el sobre de S.H.I.E.L.D. Conseguir una prueba tacha todas las combinaciones con su icono. Si un miembro de la junta no tiene secretos cuando termina un escenario de campaña, consigues una. Las pruebas no van en tu mazo, y su Inicio se resuelve en escenarios posteriores después de renovar la mano.",
  },
  accusation: {
    name: "La acusación",
    definition:
      "En la etapa 1B de Zemo puedes avanzar a La acusación y elegir una combinación no tachada de medios, móvil y oportunidad, que señala al acusado. El sobre de I.M.A. dice quién es el topo. Cada intento fallido de los cuatro coloca un contador de secreto en cada miembro de la junta. Después Zemo se da la vuelta a Desenmascarado y el topo se le vincula.",
  },
  wrongAccusation: {
    name: "Una acusación equivocada",
    definition:
      "El reglamento dice que una acusación equivocada no hace perder la partida. Pero los contadores de secreto que añade pueden dar la vuelta a los tres miembros de la junta, y eso sí la pierde. Un miembro acusado por error recibe contadores extra, y el accesorio del topo fija la Amenaza del plan principal. El juego sigue lo que dicen las cartas.",
  },
  grantedPreparation: {
    name: "Preparación concedida",
    definition:
      "Gafas de visión nocturna y Defensas automatizadas dan una Preparación a cada carta de Encuentro que no tenga una impresa. El daño que no viene de un ataque nunca activa a Viuda Negra. Una Preparación que dice «este ataque» se refiere al ataque entero. En el texto de las cartas de jugador, una carta de Preparación es un rasgo, no esta capacidad.",
  },
  reluctantFoe: {
    name: "Enemigo reacio",
    definition:
      "Enemigo reacio pone en juego un héroe de tu colección como esbirro Élite enfrentado a ti, con PLA igual a su INT y el texto Infame. El héroe conserva sus rasgos, y su título no puede coincidir con el de un personaje en juego. Su cara de héroe es aquella con la que el héroe empieza una partida. Entrar en juego y enfrentarse cuentan como la llegada de un esbirro. Cuando se le derrota, o cuando Enemigo reacio sale del juego, el héroe se retira de la partida.",
  },
  persistentDamage: {
    name: "Daño persistente (campaña experta)",
    definition:
      "En una campaña en modo Experto, cada jugador anota la Vida que le queda tras una victoria, nunca más que la base. Cada preparación ofrece una forma de restaurar tu identidad a cambio de un coste. Un jugador derrotado en un escenario ganado no participa en sus pasos de victoria, y vuelve en la siguiente preparación siguiendo el punto de curación de ese escenario. Aclaración para este juego: hasta entonces se anota con 0.",
  },
  additionalAllyCost: {
    name: "Un coste para usar a tus aliados",
    definition:
      "Conflicto de lealtades añade un coste a atacar, intervenir o defender con un aliado: gastar 1 recurso de cualquier tipo. Lo pagas al anunciarlo. Si no pagas, el aliado no actúa y no se agota. Si no tienes nada que gastar, no se ofrece el aliado. Tu héroe no paga este impuesto.",
  },

  // Civil War.
  leaderCard: {
    name: "Un líder",
    definition:
      "Un líder ocupa el lugar del villano en un escenario de Civil War y funciona exactamente como un villano. Las etapas I y II se usan en el modo normal, la III y la IV en el Experto. Fuera de Civil War, «líder enemigo» significa simplemente el villano.",
  },
  civilWarSides: {
    name: "Bandos: registro y resistencia",
    definition:
      "Cada líder, plan principal y conjunto modular de Civil War pertenece a un bando, registro o resistencia. Un escenario usa solo cartas de su propio bando, así que un líder de la resistencia nunca juega con conjuntos del registro.",
  },
  customScenario: {
    name: "Un escenario de Civil War personalizado",
    definition:
      "Constrúyelo eligiendo un bando, un líder de ese bando, tres o cuatro conjuntos modulares de ese bando, y un plan principal de etapa 1 y otro de etapa 2 de ese bando. Los conjuntos modulares de otros productos cuentan para los tres o cuatro. El juego también puede elegirlo todo al azar.",
  },
  civilWarCooperative: {
    name: "Jugar Civil War en cooperativo",
    definition:
      "El líder en juego es el líder enemigo, y es el villano. El equipo enemigo son los jugadores. Resuelve sus decisiones con la regla sombría: imagina lo que haría un rival. Una mención a tu líder no puede resolverse, así que ocurre en su lugar el efecto alternativo impreso en la carta. Haz todo lo que puedas.",
  },
  enemyTeam: {
    name: "El equipo enemigo",
    definition:
      "Cuando una carta dice que el equipo enemigo busca, elige, vincula o agota, los jugadores toman esa decisión, como lo haría un rival. En este juego la toma el jugador inicial, en una pregunta marcada como del equipo enemigo. Si solo encaja una carta u objetivo, no se pregunta nada.",
  },
  yourLeader: {
    name: "Tu líder",
    definition:
      "En una partida cooperativa no tienes líder propio, así que cualquier parte de una carta que se refiera a tu líder no hace nada. Se aplica entonces el «De no ser así» impreso, normalmente dirigido a ti o a tu héroe. El líder enemigo es el villano.",
  },
  competitiveMode: {
    name: "Modo competitivo",
    definition:
      "Algunas cartas de Civil War dicen «En modo competitivo, ...». El modo competitivo, en el que dos equipos se enfrentan a los líderes del otro, aún no está disponible en este juego. Lee esa cláusula como si no se aplicara: si la carta tiene una frase de «De no ser así», síguela, y si no, esa parte no hace nada.",
  },
  avengerTeamwork: {
    name: "Trabajo en equipo (Vengador)",
    definition:
      "Algunos esbirros de Civil War tienen Trabajo en equipo (Vengador). Cuando uno entra en juego y se enfrenta a ti, si hay en juego otro esbirro Vengador, se activa contra ti al momento. Ese otro Vengador puede estar enfrentado a otro jugador. Un esbirro que gana el rasgo Vengador cuenta.",
  },
  givenAsBoost: {
    name: "Dado al líder enemigo como carta de Aumento",
    definition:
      "Algunos esbirros dicen, al ser derrotados, que se dé esta carta al líder enemigo como carta de Aumento boca abajo. El esbirro sale del juego y va boca abajo al villano en vez de a la pila de descartes. En la siguiente activación del villano se pone boca arriba junto con la carta de Aumento que se reparta entonces.",
  },
  unregistered: {
    name: "No registrado",
    definition:
      "No registrado es un rasgo que algunas cartas dan a tu identidad o a todos los héroes. Otras cartas de Encuentro lo leen: una golpea más fuerte a una identidad No registrada, otra agota a cada identidad No registrada, y Hunting Rebel Heroes inflige daño cuando otra carta da el rasgo a los héroes.",
  },
  cannotTakeDamage: {
    name: "Objetivos que no pueden sufrir daño",
    definition:
      "Un enemigo que no puede sufrir daño no es un objetivo válido para un ataque, y eso incluye un ataque básico. No puedes elegirlo, así que nada que dependa de atacarlo puede ocurrir.",
  },
  huntedMinion: {
    name: "Presa, de Tigra",
    definition:
      "Para jugar Presa, Tigra busca un esbirro en el mazo de Encuentros y en su pila de descartes y lo pone en juego enfrentado a ella. Presa se vincula a ese esbirro y lo aturde. Mientras Tigra esté en identidad de héroe, el esbirro no tiene Guardia, y cuando se le derrota Tigra se prepara.",
  },
  shapeshift: {
    name: "Las mejoras Cambio de forma de Hulkling",
    definition:
      "Hulkling tiene cuatro mejoras Cambio de forma, y cada una cambia sus atributos mientras está en juego. Cuando una entra en juego bajo su control, se descartan todas las demás mejoras Cambio de forma que controle y él se prepara. Así tiene una sola forma a la vez, y cambiar de forma es una acción extra.",
  },
  ionicPhysiology: {
    name: "Fisiología iónica, de Hombre Maravilla",
    definition:
      "Hombre Maravilla empieza con esta mejora permanente en juego. Sus eventos de Energía se meten debajo de ella después de resolverse, hasta tres, y cada carta metida debajo añade 1 ATQ. Después de que haga un ataque básico, se descartan las cartas metidas debajo. Intervenir, defender y los eventos de ataque no las descartan.",
  },
  overpaying: {
    name: "Pagar de más un coste",
    definition:
      "Algunas cartas hacen más cuando generas más recursos que su coste. Lo que sobra es el pago de más, y lo pagas al pagar el coste. Un recurso Universal usado para pagar de más se nombra como un solo tipo. La ventana de pago muestra cuánto sobra.",
  },
  laborGiftDecks: {
    name: "Los mazos de Trabajo y Don de Hércules",
    definition:
      "Hércules tiene dos mazos de tres cartas boca abajo junto a su mazo de jugador, que no cuentan para su tamaño. En identidad de alter ego, sin ninguna carta de Trabajo en juego, muestra la primera carta de Trabajo. Cuando una carta de Trabajo llega a la zona de victoria y él está en identidad de héroe, Expiación pone en juego la primera carta de Don, una mejora permanente.",
  },
  teamworkEvent: {
    name: "Trabajo en equipo (el evento)",
    definition:
      "Trabajo en equipo es un evento de Liderazgo, no la palabra clave Trabajo en equipo de los esbirros Vengador. Juégalo como Interrupción de Héroe cuando uses tu intervención básica o tu ataque básico: agota un aliado que controles y suma el atributo correspondiente de ese aliado al de tu héroe para ese uso.",
  },

  // The client's own entries (`view/rules-reference.ts`).
  exhausted: {
    name: "Agotada",
    definition:
      "Una carta girada de lado para mostrar que ya se ha usado o comprometido así no puede volver a agotarse hasta que algo la prepare.",
  },
  ready: {
    name: "Preparada",
    definition:
      "El estado normal, en vertical, de una carta. Preparar una carta agotada la devuelve a este estado, salvo que prepararla tenga su propio coste y su controlador decida no pagarlo; entonces sigue agotada.",
  },
  facedownBoostCard: {
    name: "Carta de Aumento boca abajo",
    definition:
      "Se reparte a un enemigo desde su mazo de Encuentros en cuanto ataca o ejecuta su plan (o, en un esbirro Infame, cada vez que usa un atributo básico), y luego se pone boca arriba de una en una para sumar sus iconos al total de esa activación.",
  },
  aspectCard: {
    name: "Carta de aspecto",
    definition:
      "Una carta de jugador que muestra un aspecto, como Agresividad, Justicia, Liderazgo o Protección. Las cartas básicas y las propias de un héroe no son cartas de aspecto, salvo que una carta de héroe también imprima un aspecto (el Rayo venenoso de Spiderwoman muestra Agresividad; su Planeo controlado no muestra ninguno). Un recurso que solo sirve para una carta de aspecto, como el de Sutileza, no puede pagar nada más.",
  },
};
