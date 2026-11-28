/**
 * The Spanish text of the campaign Briefing (C08): each issue's opening line and its narrator fallback, by
 * `<campaignId>/<nodeId>`. The box's own "Handled for you" rows are in `briefing-notes-es.ts`, its setup-call words
 * and plain-words facts in `briefing-calls-es.ts`; `briefing-text.ts` picks between these and the English in
 * `stories/*.ts`. A key missing here shows the English.
 *
 * Game terms follow the official Spanish reference guide (`docs/rules/es/mc_guia_de_referencia_es_2019.md`): mazo de
 * Encuentros, carta de Encuentro, Amenaza, Vida, Plan secundario. Card, villain and hero names are the official
 * Spanish card names (`packages/content/raw/marvelcdb/es`) and the names in `campaign-copy-es.ts`; a name with no
 * Spanish card (Kingpin, Krahllak) stays English. The lines are this app's own comic-book prose, written in Spanish
 * rather than rendered word for word.
 */

/** An issue's Briefing line in Spanish: what the speaker says, and the narrator's caption when that hero is absent. */
export interface BriefingLineEs {
  readonly text: string;
  readonly fallback?: string;
}

export const BRIEFING_LINE_ES: Readonly<Record<string, BriefingLineEs>> = {
  // The Rise of Red Skull: Hawkeye and Spider-Woman.
  "trors/crossbones": {
    text: "Calavera, una montaña llena de prototipos y un reloj en marcha. Vamos.",
    fallback: "Calavera, una montaña llena de prototipos y un reloj en marcha.",
  },
  "trors/absorbing-man": {
    text: "Es un muro. No hay que romperlo, hay que pasar al otro lado.",
    fallback: "Es un muro. Nadie tiene que romperlo: basta con pasar al otro lado.",
  },
  "trors/taskmaster": {
    text: "El Quinjet ha caído, la ciudad ha cambiado de bando y Supervisor nos está cazando. Esto es lo que llevamos encima.",
    fallback:
      "El Quinjet ha caído, la ciudad ha cambiado de bando y Supervisor anda de caza. Esto es lo que lleva el equipo encima.",
  },
  "trors/zola": {
    text: "Zola tiene a gente metida en tarros. Nos los llevamos a casa.",
    fallback: "Zola tiene a gente metida en tarros. Hoy vuelven a casa.",
  },
  "trors/red-skull": {
    text: "Todo lo que hemos hecho nos ha traído hasta aquí. Que valga la pena.",
    fallback: "Todo lo que ha hecho el equipo lleva hasta aquí. Es hora de que valga la pena.",
  },

  // Galaxy's Most Wanted: Rocket and Groot.
  "gmw/brotherhood-of-badoon": {
    text: "Badoon en el casco y un cobrador de deudas en la radio. Acabemos rápido.",
    fallback: "Badoon en el casco y un cobrador de deudas en la radio.",
  },
  "gmw/infiltrate-the-museum": {
    text: "Yo soy Groot.",
    fallback: "Los especímenes robados de la galería salen esta noche, por las buenas o por las malas.",
  },
  "gmw/escape-the-museum": {
    text: "La única salida es la azotea, y ahí arriba hay un problema con forma de Coleccionista. Andando.",
    fallback: "La única salida es la azotea, y ahí arriba hay un problema con forma de Coleccionista.",
  },
  "gmw/nebula": {
    text: "Nébula nos saca ventaja y alguien la espera al otro lado. Hay que recortar distancia ya.",
    fallback: "Nébula saca ventaja y alguien la espera al otro lado.",
  },
  "gmw/ronan-the-accuser": {
    text: "Yo soy Groot.",
    fallback: "Ronan quiere la Gema y a todo el que se interponga entre él y ella. Aquí no se mueve nadie.",
  },

  // The Mad Titan's Shadow: Adam Warlock and Spectrum.
  "mts/ebony-maw": {
    text: "Knowhere está sitiado, y busque lo que busque Fauces Negras, nosotros llegamos antes.",
    fallback: "Knowhere está sitiado. Quien lo controle cuando esto acabe mantiene a raya la reserva de campaña.",
  },
  "mts/tower-defense": {
    text: "Dos villanos, dos planes, una torre. O nos separamos o lo perdemos todo.",
    fallback: "Dos villanos, dos planes, una torre.",
  },
  "mts/thanos": {
    text: "El mismísimo Thanos, y todas las Gemas que aún le faltan. Esta es la pelea de verdad.",
    fallback: "El mismísimo Thanos, en persona, a por las Gemas que quedan.",
  },
  "mts/hela": {
    text: "Odín ha desaparecido y Hela lo tiene. Con Piedras de las nornas o sin ellas, no vamos a dejarlo allí.",
    fallback: "Odín ha desaparecido. Hela lo tiene, y no vamos a dejarlo allí.",
  },
  "mts/loki": {
    text: "Todo lo que hemos cargado, de golpe. Odín está aquí. Y también todo lo que dejamos escapar.",
    fallback: "Todo lo que ha cargado la campaña pasa factura aquí, de golpe.",
  },

  // Sinister Motives: Miles Morales and Ghost-Spider.
  "sm/sandman": {
    text: "El primer nombre de la lista es Flint Marko, y ya ha cambiado de sitio tres manzanas.",
    fallback: "El primer nombre de la lista es Flint Marko, y ya ha cambiado de sitio tres manzanas del centro.",
  },
  "sm/venom": {
    text: "Lo que tenían encadenado bajo Oscorp ya no está encadenado, y no le ha hecho ninguna gracia la espera.",
    fallback: "Lo que Oscorp tenía encadenado en su sótano ya no está encadenado.",
  },
  "sm/mysterio": {
    text: "Beck no pelea limpio, y la mitad de lo que vamos a ver ni siquiera será real. Fijaos en las costuras.",
    fallback: "Quentin Beck no pelea limpio, y la mitad de lo que se avecina ni siquiera será real.",
  },
  "sm/sinister-six": {
    text: "Esta noche no van por turnos. Todos los nombres de la lista aparecen a la vez, o ninguno de nosotros vuelve a casa.",
    fallback: "Todos los villanos de la lista aparecen a la vez esta noche, o nadie del equipo vuelve a casa.",
  },
  "sm/venom-goblin": {
    text: "Aquí es donde todo lo que dejamos correr nos pasa factura por fin. Todo, esta noche.",
    fallback: "Todo lo que la partida dejó correr pasa factura por fin esta noche, de golpe.",
  },

  // Mutant Genesis: Shadowcat and Colossus.
  "mut_gen/sabretooth": {
    text: "El senador nos quiere fuera y Dientes de Sable lo quiere muerto. Lo salvamos de todos modos.",
    fallback:
      "El senador quiere a la Patrulla-X fuera y Dientes de Sable lo quiere muerto. El equipo lo salva de todos modos.",
  },
  "mut_gen/project-wideawake": {
    text: "Lo salvamos y él llamó a un ejército. A veces no entiendo a la gente.",
    fallback: "La Patrulla-X salvó al senador y él llamó a un ejército de Centinelas.",
  },
  "mut_gen/master-mold": {
    text: "Magneto dice que nos enseñará la fábrica de Centinelas. No me gusta creerle.",
    fallback:
      "Magneto se ofrece a enseñar a la Patrulla-X la fábrica de Centinelas. A nadie le gusta lo bien que suena.",
  },
  "mut_gen/mansion-attack": {
    text: "Atacan donde duermen los alumnos. Eso no lo voy a permitir.",
    fallback: "La Hermandad ataca la escuela donde duermen los alumnos. Eso no se puede permitir.",
  },
  "mut_gen/magneto": {
    text: "Los prisioneros, luego. Ahora impedimos que Magneto vuelva a despertar al Molde Maestro.",
    fallback: "Los prisioneros pueden esperar. Primero, la Patrulla-X impide que Magneto reactive al Molde Maestro.",
  },

  // MojoMania: Mojo and Spiral speak, so every line is theirs.
  "mojo/magog": {
    text: "Un episodio piloto necesita un gran nombre y un público aún mayor. Yo tengo a MaGog. Vosotros tenéis... bueno, a vosotros. Intentad ser entretenidos.",
  },
  "mojo/spiral": {
    text: "Mojo me quiere de vuelta en el plató. Mojo quiere muchas cosas. Encontradme si podéis, y traed un doble de riesgo.",
  },
  "mojo/mojo": {
    text: "Esta noche nos despedimos en todos los géneros que tengo. Tranquilos: ya os diré cuándo poner cara de sorpresa.",
  },

  // NeXt Evolution: Cable and Domino.
  "next_evol/morlock-siege": {
    text: "Hope ha pedido refuerzos. Encontramos a los Merodeadores, protegemos a los Morlocks, y ella se queda al margen.",
    fallback: "Hope ha pedido refuerzos. El equipo encontrará a los Merodeadores y protegerá a los Morlocks.",
  },
  "next_evol/on-the-run": {
    text: "Nos han dejado un rastro. Lo seguimos, recuperamos a la chica y mantenemos a su jefe fuera del edificio.",
    fallback: "Han dejado un rastro. El equipo lo sigue para recuperar a Hope.",
  },
  "next_evol/juggernaut": {
    text: "Grandote, mal genio, y cada vez va más rápido. No le dejéis coger carrerilla.",
    fallback: "Juggernaut no hace más que acelerar. El equipo no debe dejar que coja carrerilla.",
  },
  "next_evol/mister-sinister": {
    text: "Siniestro quiere a Hope para su último experimento. No la tendrá, y no le daremos ni un minuto a solas.",
    fallback: "Mister Siniestro quiere a Hope para su último experimento. El equipo no dejará que se la lleve.",
  },
  "next_evol/stryfe": {
    text: "Es mi clon y es más fuerte que yo. No es más fuerte que todos nosotros.",
    fallback: "Dyscordia es más fuerte que Cable solo. No es más fuerte que X-Force.",
  },

  // Age of Apocalypse: Bishop and Magik.
  "aoa/unus": {
    text: "Algo ha cambiado la línea temporal. Ya averiguaremos qué. Primero hay que sobrevivir a la próxima hora.",
    fallback:
      "Algo ha cambiado la línea temporal. Los héroes tienen que sobrevivir a la próxima hora antes de saber qué.",
  },
  "aoa/four-horsemen": {
    text: "Magneto dice que este mundo es de Apocalipsis. Sus Jinetes dicen lo mismo, a gritos.",
    fallback: "Magneto dice que este mundo pertenece a Apocalipsis. Sus cuatro Jinetes están de acuerdo, a gritos.",
  },
  "aoa/apocalypse": {
    text: "Nos está esperando. Bien. Eso significa que no mira hacia ningún otro sitio.",
    fallback: "Apocalipsis sabe que los héroes vienen. Eso significa que no mira hacia ningún otro sitio.",
  },
  "aoa/dark-beast": {
    text: "Dijo que podía abrir el camino de vuelta. Tendría que haberle preguntado por qué sonreía.",
    fallback: "Bestia Oscura dice que puede abrir el camino de vuelta. Nadie le pregunta por qué sonríe.",
  },
  "aoa/en-sabah-nur": {
    text: "Una oportunidad. Protegemos al Profesor, y todo lo demás se deshace.",
    fallback: "Los héroes tienen una oportunidad. Si protegen al Profesor, todo lo demás se deshace.",
  },

  // Agents of S.H.I.E.L.D.: Nick Fury and Maria Hill.
  "aos/black-widow": {
    text: "Falta una especialista y la Junta esconde algo. Empezamos por la especialista.",
    fallback: "Falta una especialista y la Junta esconde algo. Los héroes empiezan por la especialista.",
  },
  "aos/batroc": {
    text: "La Junta no va a dar el visto bueno. Si fallamos, el golpe nos cae a nosotros.",
    fallback: "La Junta no va a dar el visto bueno. Si los héroes fallan, el golpe les cae a ellos.",
  },
  "aos/modok": {
    text: "Si I.M.A. tiene un topo en la Junta, una llamada equivocada y sabrán que vamos.",
    fallback: "Si I.M.A. tiene un topo en la Junta, una llamada equivocada y sabrán que los héroes van.",
  },
  "aos/thunderbolts": {
    text: "Dicen que los envía la Junta. O la Junta miente, o miente uno de sus miembros.",
    fallback: "Dicen que los envía la Junta. O la Junta miente, o miente uno de sus miembros.",
  },
  "aos/baron-zemo": {
    text: "Se nos acaba el tiempo. Nombramos al topo con lo que tenemos, y más vale que acertemos.",
    fallback: "A los héroes se les acaba el tiempo. Nombrarán al topo con lo que tienen, y más les vale acertar.",
  },

  // Fear No Evil: Daredevil and Echo.
  "fne/art-museum-heist": {
    text: "Oigo la alarma y a la banda. Mismo edificio, distintas plantas. Separémoslos.",
    fallback: "La alarma suena y la banda está repartida por el edificio. El equipo los separa.",
  },
  "fne/the-getaway": {
    text: "Son rápidos, pero estas calles son mías. Sé dónde acaba cada esquina.",
    fallback: "Son rápidos, pero las calles son del equipo. El equipo sabe dónde acaba cada esquina.",
  },
  "fne/protection-racket": {
    text: "Esta gente tiene miedo de hablar. Démosles un motivo para dejar de tenerlo.",
    fallback: "Los tenderos tienen miedo de hablar. El equipo les da un motivo para dejar de tenerlo.",
  },
  "fne/the-raft-breakout": {
    text: "Demasiados latidos, todos camino de la puerta. Aguantamos la línea aquí.",
    fallback: "Demasiados presos van camino de la puerta. El equipo aguanta la línea.",
  },
  "fne/stop-the-presses": {
    text: "Las rotativas no paran, y las amenazas tampoco. Protegemos a la plantilla y mantenemos viva la historia.",
    fallback:
      "Las rotativas no paran, y las amenazas tampoco. El equipo protege al personal y mantiene viva la historia.",
  },
  "fne/kingpin": {
    text: "Se acabaron los intermediarios. Es él contra nosotros, y no tengo miedo.",
    fallback: "Se acabaron los intermediarios. Es Kingpin contra el equipo, y el equipo no tiene miedo.",
  },

  // Shadowland: the narrator speaks every line.
  "shadowland/shadows-in-the-night": {
    text: "Los ninjas rodean la fortaleza. Quien da las órdenes desde el tenshu baja a las calles a pelear.",
    fallback: "Los ninjas rodean la fortaleza. Quien da las órdenes desde el tenshu baja a las calles a pelear.",
  },
  "shadowland/shadow-labyrinth": {
    text: "No hay mapa: los muros se mueven, hay trampas por todas partes y alguien vigila desde la oscuridad.",
    fallback: "No hay mapa: los muros se mueven, hay trampas por todas partes y alguien vigila desde la oscuridad.",
  },
  "shadowland/heart-of-shadow": {
    text: "Krahllak apunta su ritual contra ti. La corrupción que cargas es el arma que usa.",
    fallback: "Krahllak apunta su ritual contra ti. La corrupción que cargas es el arma que usa.",
  },
};
