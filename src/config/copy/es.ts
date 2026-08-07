import { BRAND_NAME, BRAND_TAGLINE } from "../brand";

/**
 * Every user-facing string, in Spanish (es-CO).
 *
 * This file is the shape: `Copy` is inferred from it, and every other language
 * has to satisfy that type, so a missing or misspelled key fails the build
 * instead of rendering `undefined` to someone.
 *
 * Deliberately NOT `as const`. Widening the literals to `string` is what lets
 * `en.ts` be checked against this without every value having to be the same
 * Spanish text.
 *
 * Functions are used wherever a string needs interpolation, so callers never
 * build sentences by concatenation — word order is not the same in every
 * language, and a sentence assembled from fragments can only be correct in the
 * one it was written for.
 */
export const es = {
  localeName: "Español",
  /** For `Intl` — formatting conventions, not just language. */
  intlLocale: "es-CO",

  brand: {
    name: BRAND_NAME,
    tagline: BRAND_TAGLINE,
  },

  common: {
    save: "Guardar",
    cancel: "Cancelar",
    close: "Cerrar",
    delete: "Eliminar",
    add: "Agregar",
    edit: "Editar",
    copy: "Copiar",
    options: "Opciones",
    copied: "¡Copiado!",
    loading: "Cargando…",
    back: "Volver",
    unknownError: "Algo salió mal. Intenta de nuevo.",
    required: "Este campo es obligatorio",
    optional: "opcional",
    language: "Idioma",
    changeLanguage: "Cambiar idioma",
    noMatches: "Sin resultados",
  },

  /** Labels for the breadcrumb trail and the header's account control. */
  nav: {
    breadcrumbLabel: "Dónde estás",
    home: "Inicio",
    newEvent: "Nuevo evento",
    manage: "Organizar",
    evidence: "Comprobante",
    event: "Evento",
    signIn: "Entrar",
    groups: "Mis grupos",
    guestMenuLabel: "Entrar y preferencias",
  },

  home: {
    title: `${BRAND_NAME} — organiza sin perseguir a nadie`,
    heading: BRAND_NAME,
    /*
      El titular del hero, SEPARADO de la tagline de marca a propósito.

      Eran la misma constante, y eso costaba dos cosas. Una: `en.ts` importaba
      `BRAND_TAGLINE` igual que este archivo, así que un lector en inglés veía
      el titular en español. Dos: la tagline vive en la pestaña del navegador,
      en el bloque de marca y en los correos, donde tiene que ser estable —
      mientras que un titular de landing se prueba y se cambia. Atar los dos
      significaba que no se podía tocar uno sin mover el otro.

      Dos tiempos, no una frase. El punto en la mitad es el que hace el trabajo:
      obliga a leer «un link» como una cosa terminada antes de dar el resultado.
    */
    /* El alt de la foto del hero. Describe la escena, no la marca: quien la
       escucha con un lector de pantalla necesita saber qué se ve. */
    heroImageAlt: "Un equipo de fútbol femenino celebrando y tomándose una selfie en la cancha.",
    heroCardKicker: "Viernes, 8:00 p. m.",
    heroCardTitle: "Fútbol de los viernes",
    heroCardPeople: ["Ana Torres", "Camilo Ríos", "Sara Villegas", "Nico"],
    heroCardCount: "8 de 10",
    heroCardPaid: "6 ya pagaron",

    /* La tira de planes: lo que más rápido responde «¿esto para qué es?». */
    planStrip: [
      { src: "futsal", alt: "Un partido de microfútbol en una cancha de barrio." },
      { src: "pizza-casa", alt: "Un grupo de amigos comiendo pizza en la sala." },
      { src: "bolos", alt: "Cuatro amigos con bolas de boliche en una pista." },
      { src: "padel", alt: "Tres jugadoras de pádel apoyadas en la red." },
      { src: "cocina", alt: "Varias personas cocinando y sirviendo en una cocina." },
      { src: "brindis", alt: "Dos personas brindando con botellas." },
    ],

    heroTitle: "Un link.",
    heroTitleSecond: "Y ya sabes cuántos son.",
    subheading: BRAND_TAGLINE,
    /*
      La frase que dice qué ES esto, y la única de la página escrita para
      alguien que llegó sin saberlo — incluido el revisor de Google, que
      rechazó la verificación de OAuth porque la página principal no explicaba
      el propósito de la app. Empieza por el nombre a propósito: la marca solo
      existía como logo, y un logo no le sirve a quien está comprobando que el
      nombre de la pantalla de consentimiento coincide con el del sitio.
    */
    pitch:
      `${BRAND_NAME} es una app gratuita para organizar planes con tu gente: partidos, fiestas, paseos, comidas. Tus invitados abren el link y responden; tú ves la lista llenarse y quién ya te pagó, en vivo.`,
    cta: "Crear un evento",
    howItWorksTitle: "Cómo funciona",
    steps: [
      "Creas el evento y eliges si tiene costo.",
      "Compartes el link de invitados por WhatsApp.",
      "Cada quien confirma si viene, si no viene o si tal vez.",
      "Tú marcas quién ya pagó desde tu link de organizador.",
    ],
    disclaimer:
      "Esta app no mueve plata. Solo lleva la cuenta de quién pagó — los pagos los recibes tú, por fuera.",

    /*
      El nombre y el propósito en cinco palabras, encima del titular.

      Antes decía «Gratis · Sin contraseñas · Sin instalar nada», que son las
      condiciones y no el qué. Las condiciones bajaron a {@link heroTerms},
      justo antes de los botones, que es donde pesan: se leen cuando ya
      decidiste mirar y estás por decidir entrar.
    */
    heroKicker: `${BRAND_NAME} · Organiza planes con tu gente`,
    /* Lo que antes era el kicker. Mismo texto, otro sitio. */
    heroTerms: "Gratis · Sin contraseñas · Sin instalar nada",
    heroSecondary: "Ya tengo cuenta",

    /*
      Las tres razones, cada una en una tarjeta. No son funcionalidades: son
      las tres preguntas que se hace quien organiza algo un jueves. El orden
      importa — quién viene primero, porque es la que duele antes.
    */
    featuresTitle: "Para qué sirve",
    featuresBody: "Tres cosas que dejas de hacer a mano desde el primer evento.",
    stepsImageAlt: "Un grupo brindando alrededor de una mesa larga en una terraza, de noche.",
    trustImageAlt: "Dos amigos conversando y riéndose al aire libre.",
    features: [
      {
        title: "Sabes quién viene",
        body: "La lista se actualiza sola. Nadie tiene que contestar un mensaje que se perdió entre otros cincuenta del grupo.",
      },
      {
        title: "Sabes quién ya pagó",
        body: "Junti reparte la cuenta y lleva el registro. Se acabó el «yo ya te consigné» sin que nadie sepa si es cierto.",
      },
      {
        title: "Nadie tiene que instalar nada",
        body: "Tus invitados abren un link y responden. Sin cuenta previa, sin descargar una app para ir a jugar fútbol.",
      },
    ],

    /* El cierre. Repite la acción una vez, abajo, para quien leyó todo. */
    closingTitle: "Tu próximo plan, sin perseguir a nadie",
    closingBody: "Toma un minuto crear el primero. Si no te sirve, no perdiste nada.",

    /*
      Las señales de que algo tiene que cambiar.
      Escritas como escenas, no como problemas abstractos: quien organiza algo
      reconoce la suya en dos segundos o no la reconoce nunca.
    */
    painTitle: "Te suena alguna de estas",
    painBody: "Si organizas algo con más de tres personas, ya viviste al menos una.",
    pains: [
      {
        title: "«Yo voy» × 14, y no sabes cuántos son",
        body: "El grupo se llena de respuestas sueltas entre memes. A las once de la noche te toca subir y contar a mano.",
      },
      {
        title: "«Ya te consigné» y nadie sabe quién falta",
        body: "Llevas la cuenta en notas del celular, o en la cabeza. Al final pones de tu bolsillo lo que no cuadró.",
      },
      {
        title: "Terminas persiguiendo gente por privado",
        body: "Escribiéndole uno por uno a los que no respondieron, para confirmar algo que ya dijeron en el grupo.",
      },
    ],

    /*
      Por qué esto funciona. No son funcionalidades: son las tres decisiones de
      diseño que hacen que se pueda confiar, y cada una es verificable en la app.
    */
    differenceTitle: "Por qué puedes confiarle esto a tu grupo",
    differenceBody: "Tres decisiones que tomamos a propósito, y que puedes comprobar.",
    differences: [
      {
        title: "Tu plata nunca pasa por acá",
        body: "Junti calcula y lleva el registro. El dinero te lo transfieren a ti directo, por el medio que ustedes acuerden. No custodiamos, no cobramos comisión y no podríamos retenerlo aunque quisiéramos.",
      },
      {
        title: "Nadie recibe un correo sin haber dicho que sí",
        body: "Solo puedes invitar a gente que aceptó un link tuyo. No hay lista de contactos que pegar ni direcciones de terceros guardadas. Salirse es un clic.",
      },
      {
        title: "Sin contraseñas y sin instalar nada",
        body: "Se entra con Google o con un link al correo. Tus invitados abren el link y responden desde donde estén.",
      },
    ],

    /* Los números reales del producto. Se ocultan si todavía son bajos. */
    statsTitle: "Lo que ya pasó por acá",
    statsEvents: "eventos creados",
    statsAnswers: "respuestas registradas",
    statsPayments: "pagos marcados",

    faqTitle: "Lo que la gente pregunta",
    faqs: [
      {
        q: "¿Cuánto cuesta?",
        a: "Nada. Junti es gratis y hoy no tiene planes de pago. Si algún día cambia, lo vas a saber antes, no después.",
      },
      {
        q: "¿Junti recibe el dinero de mi evento?",
        a: "No, y no es una limitación temporal: es una decisión de producto. La app reparte la cuenta y guarda si tú diste un pago por recibido. La plata va directo a ti, por fuera de la app.",
      },
      {
        q: "¿Mis invitados tienen que crear una cuenta?",
        a: "Sí, para responder. Es lo que hace que su lugar quede a su nombre y no al del teléfono, que puedan cambiar la respuesta desde otro celular, y que nadie pueda contestar por ellos. Se entra con Google o con un link al correo, sin contraseña.",
      },
      {
        /*
          Escrita para dos lectores: el usuario que duda antes de entrar con
          Google, y el revisor de verificación OAuth — cuyo checklist exige que
          la página principal explique con transparencia para qué pide la app
          los datos del usuario. Es la misma pregunta, y la respuesta honesta
          les sirve a los dos.
        */
        q: `¿Qué hace ${BRAND_NAME} con mi cuenta de Google?`,
        a: "Solo dejarte entrar. Al iniciar sesión con Google, la app recibe tu nombre, tu correo y tu foto de perfil, y los usa para mostrarte en las listas y avisarte de tus eventos. No toca tu calendario, ni tus contactos, ni nada más de tu cuenta. El detalle completo está en el aviso de privacidad.",
      },
      {
        q: "¿Quién puede ver mi teléfono?",
        a: "Solo el organizador de un evento al que te apuntaste, y solo si tú lo diste marcando la casilla. Los demás invitados ven tu nombre y tu respuesta, nunca tu correo ni tu teléfono.",
      },
      {
        q: "¿Puedo borrar mi cuenta?",
        a: "Cuando quieras, escribiendo a hello@vennet.dev. En el aviso de privacidad está exactamente qué se borra y qué se conserva anonimizado, y por qué.",
      },
      {
        q: "¿Y si el evento se cancela?",
        a: "Avisas desde tu panel: le llega un correo a quien dijo que venía y se les quita del calendario. Los pagos registrados no se borran — es la única evidencia que tienen ustedes dos de quién puso qué.",
      },
    ],
  },

  createEvent: {
    wizard: {
      progress: (step: number, total: number) => `Paso ${step} de ${total}`,
      stepTitle: {
        1: "Qué, cuándo y dónde",
        2: "A quién, requisitos y cuentas",
      } as Record<number, string>,
      next: "Siguiente",
      back: "Atrás",
    },
    title: "Crear evento",
    heading: "Nuevo evento",
    subheading: "Solo toma un minuto.",
    fields: {
      title: "¿Qué van a hacer?",
      titlePlaceholder: "Fútbol de los jueves",
      titleHelp: "Así lo verán tus invitados.",
      kind: "Tipo de evento",
      startsAt: "¿Cuándo?",
      startsAtHelp: (zone: string) => `Hora de ${zone}.`,
      startsAtDatePlaceholder: "Elige el día",
      startsAtTimePlaceholder: "Hora",
      startsAtDateLabel: "Día",
      startsAtTimeLabel: "Hora",
      timeZone: "Zona horaria",
      timeZoneHelp:
        "La hora del evento se muestra siempre en esta zona, para todos. Nadie tiene que hacer cuentas.",
      location: "¿Dónde?",
      locationPlaceholder: "Cancha La 90, Medellín",
      capacity: "Cupo máximo",
      capacityPlaceholder: "10",
      capacityHelp:
        "Déjalo vacío si no hay límite. Al llenarse, los demás entran en lista de espera.",
      rsvpLead: "Cierre de la convocatoria",
      rsvpLeadHelp:
        "Hasta cuándo pueden confirmar. Se calcula desde la hora del evento, así que si lo mueves, el cierre se mueve con él.",
      rsvpLeadNone: "Sin fecha límite",
      /**
       * One label per option in `LEAD_HOURS`, keyed by the hours themselves.
       *
       * Written out rather than generated from the number, because "24 horas
       * antes" is not how anybody says "un día antes", and a formatter that
       * got it right in Spanish would still have to be taught English.
       */
      rsvpLeadOptions: {
        2: "2 horas antes",
        6: "6 horas antes",
        24: "1 día antes",
        48: "2 días antes",
        72: "3 días antes",
        168: "1 semana antes",
      } as Record<number, string>,
      notes: "Notas",
      notesPlaceholder: "Llevar camiseta blanca y guayos.",
      costMode: "¿Tiene costo?",
      costAmount: "Monto",
      costAmountHelpTotal: "Se reparte en partes iguales entre quienes confirmen que vienen.",
      costAmountHelpPerPerson: "Cada persona que confirme paga este monto.",
      currency: "Moneda",
      refundNotice: "Política de devolución",
      refundNoticeHelp:
        "Si alguien pagó y se baja, ¿con cuánta anticipación debe avisar para que le devuelvas el dinero? Se muestra antes de confirmar, para que nadie se sorprenda.",
      refundNoticeOptions: {
        none: "Sin política",
        hours: (n: number) => (n < 48 ? `Avisar ${n} horas antes` : `Avisar ${n / 24} días antes`),
      },
    },
    costModes: {
      none: "Sin costo",
      total: "Costo total a repartir",
      per_person: "Un monto por persona",
    },
    submit: "Crear evento",
    submitting: "Creando…",
  },

  eventCreated: {
    heading: "¡Listo! Tu evento está creado",
    subheading: "Guarda estos dos links. Son la única forma de volver a entrar.",
    participantLinkLabel: "Link para invitados",
    participantLinkHelp:
      "Este es el que compartes. Con él dicen si vienen y ven quién debe cuánto.",
    organizerLinkLabel: "Tu link de organizador",
    organizerLinkHelp:
      "Para que alguien más te ayude a manejar el evento. Con él marca pagos, invita y cierra el evento.",
    organizerLinkNote:
      "No tienes que guardarlo: el evento queda en «Mis eventos» y siempre puedes volver desde ahí. Quien reciba este link necesita entrar con su cuenta, y solo tú puedes editar los datos del evento.",
    shareWhatsApp: "Compartir por WhatsApp",
    goToManage: "Ir a mi panel de organizador",
  },

  event: {
    closedBadge: "Cerrado",
    closedNotice:
      "Este evento está cerrado. Ya nadie puede decir si viene ni cambiar su respuesta.",
    notFoundTitle: "No encontramos este evento",
    notFoundBody: "El link puede estar incompleto o el evento pudo haber sido eliminado.",
    noLocation: "Sin lugar definido",
    whenLabel: "Cuándo",
    inZone: (place: string) => `hora de ${place}`,
    eventLocalTime: (when: string, place: string) => `En ${place}: ${when}`,
    whereLabel: "Dónde",
    notesLabel: "Notas",
    capacityLabel: "Cupo",
    capacityUnlimited: "Sin límite",
    capacityValue: (taken: number, total: number) => `${taken} de ${total}`,
    spotsLeft: (n: number) => (n === 1 ? "Queda 1 cupo" : `Quedan ${n} cupos`),
    full: "Cupo lleno",
    /* The download, named for what somebody gets rather than for the format.
       "Descargar .ics" is a filename; nobody wants a file, they want the plan
       to show up on their phone on Thursday. */
    addToCalendar: "Agregar a mi calendario",
    addToCalendarHelp: "Se descarga un archivo que abre tu calendario — Google, Apple o el que uses.",

    convocationTitle: "La convocatoria cierra en",
    convocationUrgentTitle: "Última hora para confirmar",
    /* The absolute moment, under the ticking one. This is the line that
       carries the meaning: the numbers above it move, and somebody who reads
       the page with a screen reader — or screenshots it into the group chat —
       needs a date, not a duration. */
    convocationClosesAt: (when: string) => `Hasta el ${when}`,
    convocationUnits: {
      day: (n: number) => (n === 1 ? "1 día" : `${n} días`),
      hour: (n: number) => `${n} h`,
      minute: (n: number) => `${n} min`,
      second: (n: number) => `${n} s`,
    },
    convocationClosedNotice: "La convocatoria ya cerró.",
    convocationClosedBody:
      "Ya no se puede confirmar ni cambiar la respuesta. Si necesitas entrar, habla con quien organiza.",

    preview: {
      /* Deliberately blunt. Un organizador que se olvide de que está en vista
         previa va a creer que la app se le dañó. */
      title: "Vista previa",
      guestBody: "Así ve esta página alguien que ya entró a su cuenta y todavía no ha respondido.",
      strangerBody: "Así ve esta página alguien que abre el link sin tener cuenta.",
      /* La advertencia va aparte del cuerpo porque solo aplica a un modo: sin
         sesión no hay nada que oprimir. */
      guestWarning: "Los botones funcionan de verdad: si confirmas desde aquí, quedas apuntado.",
      asGuest: "Como invitado",
      asStranger: "Sin cuenta",
      /* En el menú de la card hacen falta el verbo y el contexto: ahí no hay
         una barra encima que ya haya dicho de qué se trata. */
      viewAsGuest: "Ver como invitado",
      viewAsStranger: "Ver sin cuenta",
      exit: "Salir de la vista previa",
      /* En el panel del organizador, justo debajo del link que va a compartir. */
      sectionLabel: "Míralo como lo van a ver",
      sectionHelp: "Antes de mandar el link, revisa con qué se encuentra quien lo abra.",
    },
  },

  claim: {
    kicker: (sponsor: string) => `${sponsor} te apartó un cupo`,
    holdIsYours: (sponsor: string) => `Este cupo es tuyo. ${sponsor} ya respondió por él — solo ponle tu nombre.`,
    signInToClaim: "Entra con Google o con un link a tu correo, sin contraseña, y el cupo queda a tu nombre.",
    claimCta: "Reclamar mi cupo",
    claiming: "Reclamando…",
    yours: "El cupo es tuyo",
    yoursBody: "Ya apareces en la lista con tu nombre. Nos vemos allá.",
    takenTitle: "Este cupo ya fue reclamado",
    taken: "Alguien más ya tomó este cupo. Pídele otro link a quien te invitó.",
    ownSpot: "Este cupo lo apartaste tú — es para otra persona.",
    alreadyIn: "Ya estás en la lista de este evento con tu propia respuesta.",
    goToEvent: "Ver el evento",
    groupsHeading: (sponsor: string) => `Los parches de ${sponsor}`,
    groupsHelp: "Si te unes, te pueden invitar directo a los próximos planes. Tú decides grupo por grupo.",
    viewGroup: "Ver grupo",
  },

  /**
   * El panel del dueño (/funnel). Una sola lectora hoy, y aun así localizado:
   * los textos quemados en un componente son los que nadie encuentra cuando
   * toca traducir, y la regla de la casa es una — todo string visible vive
   * aquí.
   */
  panel: {
    title: "Panel",
    subtitle: "Cuánto hay, hacia dónde va, y dónde se cae la gente.",
    tabs: { overview: "Resumen", funnels: "Embudos", operations: "Operación", directory: "Datos" },
    range: {
      last30: "Últimos 30 días",
      lastWeek: "Última semana",
      yesterday: "Ayer",
      last24h: "Últimas 24 h",
      fromDate: "Desde esa fecha",
      fromDateAria: "Desde esta fecha hasta hoy",
      note: (from: string, to: string) =>
        `Todo lo de abajo cuenta lo creado del ${from} al ${to}. Lo marcado «toda la vida» no se filtra.`,
    },
    noData: "Sin datos",
    noDataYet: "Sin datos todavía.",
    inPeriod: (n: string) => `+${n} en el periodo`,
    headlines: {
      accounts: "Usuarios registrados",
      events: "Eventos creados",
      groups: "Grupos",
      emails: "Correos enviados",
    },
    money: {
      label: "Plata coordinada",
      breakdown: (confirmed: string, inWindow: string) =>
        `${confirmed} confirmada · ${inWindow} en el periodo`,
    },
    activity: {
      label: "Actividad",
      caption: (days: number) =>
        days === 1 ? "respuestas en el día" : `respuestas en ${days} días`,
      aria: "Tendencia de respuestas",
    },
    paidRing: {
      label: "Eventos con costo",
      help: "Base de cualquier comisión futura.",
      aria: (percent: number) => `${percent}% de los eventos tienen costo`,
    },
    trends: {
      accounts: "Cuentas nuevas",
      events: "Eventos creados",
      rsvps: "Respuestas",
      emails: "Correos enviados",
      aria: (title: string) => `${title} en el periodo`,
    },
    attendance: {
      heading: "Respuestas por tipo",
      going: "Van",
      maybe: "Tal vez",
      notGoing: "No van",
      waitlisted: "En espera",
    },
    projection: {
      heading: "Al ritmo actual, en 30 días",
      help: "Con «≈»: extrapolado de las últimas 4 semanas completas. Sin él: el ritmo real del periodo, mientras se acumula historial.",
      accounts: "Usuarios nuevos",
      events: "Eventos",
      rsvps: "Respuestas",
      fallback: (label: string) => `${label} · lo que dio el periodo`,
    },
    depth: {
      heading: "Si esto sirve o no",
      help: "Toda la vida, no el periodo.",
      of: (part: number, whole: number) => `${part} de ${whole}`,
      repeatOrganizers: "Organizadores que repiten",
      repeatOrganizersHelp: "Crearon un segundo evento — el número que decide todo.",
      repeatParticipants: "Participantes que vuelven",
      repeatParticipantsHelp: "Se apuntaron a un segundo evento distinto.",
      typicalSize: "Tamaño típico",
      typicalSizeHelp: "Confirmados por evento, promedio.",
      people: (n: number) => `${n} personas`,
      firstAnswer: "Del evento a la primera respuesta",
      firstAnswerHelp: "Mediana de creación → primer «voy».",
      lessThanHour: "Menos de una hora",
      hours: (h: number) => `${h} h`,
      undelivered: "Correos que no llegaron",
      undeliveredHelp: "Fallidos + suprimidos. El costo marginal real.",
      undeliveredDetail: (failed: number, suppressed: number) =>
        `${failed} fallidos · ${suppressed} suprimidos`,
    },
    funnels: {
      help: "El periodo filtrado arriba. Cada porcentaje es contra el primer paso, no contra el anterior: tres pasos seguidos al 80% suenan bien y significan que se fue la mitad.",
      participants: "Participantes",
      participantsHelp: "Dónde se cae la gente entre abrir el link y quedar contada.",
      organizers: "Organizadores",
      organizersHelp: "Dónde se abandona entre abrir el formulario y tener un evento.",
      groups: "Grupos",
      groupsHelp: "Si el link se vuelve membresía, y cuántos dicen que no.",
    },
    calendarGate: {
      heading: "¿Alguien quiere calendario?",
      help: "La compuerta de la tarjeta de Google Calendar. Se lee sobre un ciclo completo de un evento recurrente — seis a ocho semanas. Una semana es una lectura de novedad, no de hábito.",
      downloads: "Descargan el .ics",
      downloadsDetail: (downloads: number, viewers: number) =>
        `${downloads} de ${viewers} que abrieron un evento`,
      repeats: "Repiten",
      repeatsNobody: "Nadie con sesión ha descargado todavía",
      repeatsDetail: (repeat: number, known: number) =>
        `${repeat} de ${known} con sesión, más de una vez`,
      cancellations: (n: number) =>
        n === 1
          ? "1 descarga fue de un evento cancelado. No cuentan como demanda — sacar algo muerto del calendario es lo contrario de querer sincronizarlo."
          : `${n} descargas fueron de un evento cancelado. No cuentan como demanda — sacar algo muerto del calendario es lo contrario de querer sincronizarlo.`,
      anonymousNote:
        "El porcentaje de repetición sólo ve a quien tenía sesión al descargar. La ruta no exige cuenta, así que a un lector anónimo no hay forma de contarlo dos veces.",
    },
    directory: {
      kinds: { usuarios: "Usuarios", eventos: "Eventos", grupos: "Grupos" },
      searchPlaceholder: {
        usuarios: "Buscar por nombre o correo",
        eventos: "Buscar por título",
        grupos: "Buscar por nombre",
      },
      searchSubmit: "Buscar",
      clearSearch: "Limpiar",
      filters: {
        todos: "Todos",
        con_costo: "Con costo",
        gratis: "Gratis",
        cancelados: "Cancelados",
      },
      results: (n: number) => (n === 1 ? "1 resultado" : `${n.toLocaleString("es-CO")} resultados`),
      pageOf: (page: number, pages: number) => `Página ${page} de ${pages}`,
      previous: "Anterior",
      next: "Siguiente",
      empty: "Nada con ese filtro en este periodo.",
      created: (when: string) => `creado ${when}`,
      userMeta: (events: number, rsvps: number) =>
        `${events} ${events === 1 ? "evento creado" : "eventos creados"} · ${rsvps} ${rsvps === 1 ? "participación" : "participaciones"}`,
      eventMeta: (attending: number) =>
        `${attending} ${attending === 1 ? "confirmado" : "confirmados"}`,
      eventPaid: "con costo",
      eventFree: "gratis",
      eventCancelled: "cancelado",
      groupMeta: (members: number, events: number) =>
        `${members} ${members === 1 ? "miembro" : "miembros"} · ${events} ${events === 1 ? "evento" : "eventos"}`,
    },
    operations: {
      sendsHeading: "Envíos por organizador",
      sendsHelp:
        "El periodo filtrado arriba. El pico de una hora es la señal: cien envíos repartidos en días es alguien ocupado; cien en una hora es alguien probando hasta dónde llega esto.",
      sendsEmpty: "Nadie ha enviado nada en este periodo.",
      sendsDay: (n: number) => `${n} en el periodo`,
      sendsPeak: (n: number) => `pico ${n}/h`,
      limitsHeading: "Límites vigentes",
      limitsHelp: "Los topes de envío que protegen la reputación del correo.",
      limitDefault: "por defecto",
      limitAdjusted: "ajustado",
      mailHeading: "Correos",
      mailHelp:
        "Pendiente es normal por un momento: cada mensaje se intenta al escribirlo y el barrido corre cada seis horas. Fallido es que se agotaron los cinco intentos.",
      mailPending: "pendientes",
      mailFailed: "fallidos",
      mailAttempts: (n: number) => `${n} intentos`,
      recentHeading: "Últimos 50 eventos del periodo",
      recentEmpty: "Nada en este periodo. Los eventos llegan con el uso.",
    },
  },

  settlement: {
    heading: "Cuentas finales",
    help: "El costo se reparte entre quienes vienen. Si alguien se bajó después de que otros pagaron, la cuota subió y acá está lo que falta por persona.",
    shortfall: (amount: string) => `Faltan ${amount} para cubrir el costo — si nadie completa, salen de tu bolsillo.`,
    row: (paid: string, share: string) => `Pagó ${paid} · cuota final ${share}`,
    missing: (amount: string) => `Le falta ${amount}`,
    received: "Recibí la diferencia",
    receivedDone: (name: string) => `Listo — ${name} quedó al día.`,
    requestEmails: "Pedir el saldo por correo",
    requesting: "Enviando…",
    requested: (n: number) =>
      n === 1
        ? "Enviamos 1 correo pidiendo el saldo."
        : `Enviamos ${n} correos pidiendo el saldo.`,
    requestedNone: "No había a quién escribir — nadie con correo verificado o ya se pidió hoy.",
    covered: "Todos los que pagaron están al día con la cuota final.",
    refundables: (n: number, total: string) =>
      n === 1
        ? `Tienes ${total} de 1 persona que ya no viene — devolverlo o contarlo es entre ustedes.`
        : `Tienes ${total} de ${n} personas que ya no vienen — devolverlo o contarlo es entre ustedes.`,
    dropouts: "De quienes ya no vienen",
    dropoutPaid: (amount: string) => `Pagó ${amount}`,
    verdictRefund: (hours: number) =>
      `Avisó con más de ${hours} horas — según tu política, le devuelves.`,
    verdictForfeit: (hours: number) =>
      `Avisó con menos de ${hours} horas — según tu política, no hay devolución.`,
    verdictUnknown: "No quedó registrado cuándo se bajó — decídelo tú.",
    forfeitCoversGap: (amount: string) =>
      `Lo retenido según tu política cubre ${amount} de lo que falta.`,
  },

  heldSpots: {
    heading: "Trae gente",
    help: "Aparta cupos para quienes vienen contigo. Tú respondes por ellos hasta que reclamen su cupo con el link.",
    countLabel: "¿Cuántos cupos más?",
    nameLabel: (n: number) => `Nombre del invitado ${n}`,
    namePlaceholder: "Opcional — para saber quién es",
    submit: "Apartar cupos",
    submitting: "Apartando…",
    held: "Cupos apartados",
    copyLink: "Copiar link de invitación",
    copied: "¡Copiado!",
    release: "Liberar",
    released: "Cupo liberado.",
    shareHint: "Pásale el link por WhatsApp a cada persona: al abrirlo crea su cuenta y el cupo queda a su nombre.",
    mustJoinFirst: "Primero confirma que vienes; después apartas cupos para tu gente.",
    overAllowance: (max: number) => `Máximo ${max} cupos por persona en cada evento.`,
    overCapacity: "No quedan cupos suficientes para apartar esos.",
    broughtBy: (name: string) => `Trae: ${name}`,
    /** El switch del paso 1 del wizard: cupos declarados con la respuesta. */
    switchLabel: "Traigo gente",
    switchHelp: "Aparta cupos para tu gente: pagas su cuota y a cada uno le pasas un link.",
  },

  /** El wizard de participación: Respuesta · Comprobante · Mensaje. */
  joinWizard: {
    /* "Pago", no "Comprobante": tres pestañas comparten un ancho de teléfono
       y la palabra larga salía rozando el borde. */
    tabs: {
      answer: "Respuesta",
      requirements: "Pago",
      message: "Mensaje",
    },
    pendingBanner:
      "Aún no estás confirmado — tu cupo queda pendiente hasta que el organizador apruebe tu comprobante.",
    confirmedBanner: "Estás confirmado. Todo en orden.",
    yourShare: "Tu cuota",
    shareIncludesGuests: (n: number) =>
      n === 1 ? "Incluye tu invitado." : `Incluye tus ${n} invitados.`,
    messageHeldNote:
      "Tu mensaje se guarda ya, pero se publica en el evento cuando estés confirmado.",
    answersClosedButRecorded:
      "La convocatoria cerró — tu respuesta quedó registrada. Puedes seguir con el comprobante y tu mensaje.",
  },

  roster: {
    heading: "Quién viene",
    inTitle: "Vienen",
    /* "Se bajaron", no "No vienen": a este grupo solo se llega respondiendo.
       Quien nunca contestó no aparece en ninguna lista, así que estas filas
       son gente que estuvo en la conversación y se salió — y ese es el hecho
       que el organizador rastrea, sobre todo cuando dejaron plata. */
    outTitle: "Se bajaron",
    /* Pills del carril de estado para quien se bajó con plata confirmada.
       El estado va en un pill, nunca pegado al nombre. */
    pillRefund: (amount: string) => `Devolverle ${amount}`,
    pillForfeit: "Sin devolución",
    pillPaidOut: (amount: string) => `Pagó ${amount}`,
    /* El otro camino de salida: no se bajó, lo bajaron. Mismo carril de
       pills; la distinción existe porque una disputa empieza ahí. */
    pillRemoved: "Removido",
    maybeTitle: "Tal vez",
    waitlistedTitle: "Lista de espera",
    empty: "Todavía nadie ha confirmado. Sé el primero.",
    emptyGroup: "Nadie por aquí.",
    countIn: (n: number) => (n === 1 ? "1 persona" : `${n} personas`),
    pendingPolicyTitle: "Sala de espera",
    pendingPolicyHelp:
      "Dijeron que vienen, pero todavía no cumplen lo que pide el evento. No cuentan como confirmados.",
    waitingOn: (labels: string) => `Falta: ${labels}`,
    inReview: (labels: string) => `En revisión: ${labels}`,
  },

  attendance: {
    in: "Voy",
    out: "No voy",
    maybe: "Tal vez",
    waitlisted: "En espera",
  },

  rsvp: {
    heading: "Dinos si vienes",
    headingEditing: "Cambia tu respuesta",
    nameLabel: "Tu nombre",
    namePlaceholder: "Cómo te dicen tus amigos",
    nameHelp: "Entre 1 y 40 caracteres. Úsalo igual cada vez para no aparecer dos veces.",
    attendanceLabel: "¿Vienes?",
    refundPolicy: (hours: number) =>
      `Política de devolución: si pagas y te bajas, avisa con al menos ${hours} horas de anticipación para que te devuelvan el dinero. Después de ese plazo no hay devolución.`,
    refundLate: (hours: number) =>
      `Falta menos de ${hours === 24 ? "un día" : `${hours} horas`} para el evento. Según la política del organizador, si te bajas ahora no te devuelven lo que pagaste.`,
    submit: "Confirmar",
    submitEditing: "Actualizar mi respuesta",
    submitting: "Enviando…",
    yourRsvp: (name: string) => `Estás en la lista como ${name}.`,
    changeMine: "Cambiar mi respuesta",
    saved: "Listo, quedaste en la lista.",
    savedEditing: "Actualizamos tu respuesta.",
    waitlistedShort: "Listo, quedaste en lista de espera.",
    waitlistedNotice:
      "El cupo está lleno, así que quedaste en lista de espera. Si alguien cancela, el organizador te avisa y te sube.",
    willBeWaitlisted:
      "El cupo está lleno. Si eliges «Voy», quedas en lista de espera y el organizador te sube si alguien cancela.",
    duplicateName:
      "Ya hay alguien con tu mismo nombre en este evento. Ajusta tu nombre en tu perfil (por ejemplo, agrega tu apellido) e inténtalo de nuevo.",
    closed: "El evento está cerrado y ya no acepta cambios.",
    oneTapHeading: "Apúntate de una",
    oneTapSubmit: (name: string) => `Voy — apúntame como ${name}`,
    oneTapSubmitting: "Apuntándote…",
    oneTapHelp: "Un toque y quedas en la lista. Después puedes cambiar tu respuesta.",
    oneTapNameTaken:
      "Ya hay alguien con tu mismo nombre en este evento. Ajusta tu nombre en tu perfil e inténtalo de nuevo.",
    signedInAs: (name: string) => `Estás como ${name}.`,
    signInHeading: (title: string) => `Entra para apuntarte a ${title}`,
    signInHelp:
      "Es con Google o con un link a tu correo, sin contraseña, y vuelves derecho a este evento.",
    signInBenefits: [
      "Tu lugar queda guardado a tu nombre, no al del teléfono.",
      "Cambias tu respuesta desde cualquier celular, cuando quieras.",
      "Ves qué te toca pagar y si el organizador ya lo dio por recibido.",
      "Todos los planes a los que te apuntas quedan en un solo lugar.",
    ],
    signInCta: "Iniciar sesión o crear cuenta",
    signInAlreadyIn: "Ya van:",
    signInAndMore: (n: number) => (n === 1 ? "y 1 más" : `y ${n} más`),
  },

  policies: {
    sectionTitle: "Requisitos para quedar confirmado",
    sectionHelp:
      "Quien diga que viene pero no los cumpla aparece aparte, como pendiente. Tú decides cuáles pones.",
    labelField: "¿Cómo se llama?",
    descriptionField: "Instrucciones",
    customize: "Personalizar",
    maxReached: (max: number) => `Puedes pedir hasta ${max} requisitos por evento.`,
    labelOverrideHelp: "Déjalo vacío para usar el nombre de siempre.",
    descriptionOverrideHelp: "Déjalo vacío para usar las instrucciones de siempre.",
    unsupported:
      "Esta versión del app no sabe cómo pedir este requisito. No bloquea a nadie; avísale a quien administra el catálogo.",
    handlerHelp: {
      file_upload_reviewed: "Suben una foto y tú la apruebas.",
      self_acknowledged: "Marcan una casilla. Queda cumplido de una vez, sin que revises nada.",
    } as Record<string, string>,
    status: {
      missing: "Pendiente",
      submitted: "En revisión",
      approved: "Cumplido",
      rejected: "Rechazado",
    },
    yourStatusHeading: "Lo que falta para tu confirmación",
    allDone: "Cumpliste todo. Ya estás confirmado.",
    blockedNotice: (labels: string) =>
      `Estás en la lista, pero todavía no confirmado: falta ${labels}.`,
    acknowledgeSubmit: "Confirmo que lo leí",
    acknowledged: "Ya lo confirmaste.",
    uploadLabel: "Foto del comprobante",
    uploadHelp: "JPG, PNG o WebP. La reducimos en tu teléfono antes de subirla.",
    uploadChoose: "Elegir foto",
    uploadChange: "Cambiar foto",
    uploadSubmit: "Enviar comprobante",
    uploadSubmitting: "Enviando…",
    uploadPreparing: "Preparando la imagen…",
    noteLabel: "Nota",
    noteHelp: "Opcional. Por ejemplo, el número de la transferencia.",
    notePlaceholder: "Transferencia 4471",
    submittedNotice: "Enviado. El organizador lo revisa y te confirma.",
    rejectedNotice: (reason: string) => `El organizador no lo aceptó: ${reason}`,
    rejectedNoticeNoReason: "El organizador no lo aceptó. Vuelve a enviarlo.",
    resubmit: "Enviar otro",
    onlyOrganizerSeesEvidence: "Solo el organizador ve esta foto. No aparece en la lista pública.",
  },

  review: {
    heading: "Por revisar",
    empty: "No hay nada pendiente de revisar.",
    pendingCount: (n: number) => (n === 1 ? "1 por revisar" : `${n} por revisar`),
    approve: "Aprobar",
    reject: "Rechazar",
    reasonLabel: "¿Por qué?",
    reasonPlaceholder: "La foto no se ve, no coincide el monto…",
    reasonHelp: "Se lo mostramos a la persona para que lo vuelva a enviar.",
    submittedBy: (name: string, when: string) => `${name} · enviado ${when}`,
    approvedNotice: "Aprobado.",
    rejectedNotice: "Rechazado. La persona ya puede volver a enviarlo.",
    noEvidence: "Sin foto adjunta.",
    expandEvidence: (name: string) => `Ver el comprobante de ${name} en grande`,
    evidenceGone: "El comprobante ya no está.",
  },

  commitments: {
    heading: "¿Llevas algo?",
    help: "Cuéntale al grupo qué llevas. Lo ven todos los que abran el link.",
    notePlaceholder: "Yo llevo el balón",
    reactionLabel: "O elige un emoji",
    save: "Publicar",
    saving: "Publicando…",
    update: "Actualizar",
    remove: "Borrar lo mío",
    removeOne: "Borrar",
    removedToast: "Borrado.",
    feedHeading: "Quién lleva qué",
    feedEmpty: "Todavía nadie ha dicho qué lleva. Sé el primero.",
    mustJoinFirst: "Primero dinos que vienes.",
    errorEmpty: "Escribe algo o elige un emoji.",
    errorTooLong: (max: number) => `Máximo ${max} caracteres.`,
    errorReaction: "Ese emoji no está disponible.",
    quickPicks: ["Yo llevo el balón ⚽", "Llevo la torta 🎂", "Yo pongo la música 🥁", "Allí estaré 🏃"],
  },

  money: {
    surplus: (amount: string) =>
      `Tienes ${amount} por encima del costo — retenidos de quien se bajó o pagos de más.`,
    heading: "Cuentas",
    owesLabel: "Debe",
    collectedLabel: "Recaudado",
    outstandingLabel: "Falta",
    /* Lo que se está cobrando, no el costo bruto: con gente exonerada los
       dos difieren, y todos los números de la tarjeta miden contra este. */
    totalLabel: "Total a recaudar",
    perPersonLabel: "Por persona",
    /** El mismo dato al lado de un precio, donde "Por persona" ya no cabe en la línea. */
    perPersonShort: "c/u",
    paid: "Pagó",
    pending: "Debe",
    waived: "Sin cobro",
    noCost: "Este evento no tiene costo.",
    /** El mismo hecho que `noCost`, del tamaño de una etiqueta en una tarjeta. */
    free: "Gratis",
    splitAmong: (n: number) =>
      n === 1 ? "Repartido entre 1 persona" : `Repartido entre ${n} personas`,
    nobodyIn: "Nadie ha confirmado todavía, así que aún no hay nada que repartir.",
    progressLabel: (collected: string, total: string) => `${collected} de ${total}`,
  },

  manage: {
    cancelHeading: "Cancelar el evento",
    cancelHelp:
      "Distinto de cerrarlo. Cerrar congela las confirmaciones y el evento igual se hace; cancelar avisa que no va, le llega un correo a quien dijo que venía, y se les quita del calendario.",
    cancel: "Cancelar evento",
    cancelling: "Cancelando…",
    cancelConfirm: (title: string) => `¿Cancelar ${title}?`,
    cancelConfirmBody:
      "Le avisamos por correo a todos los que dijeron que venían y les quitamos el evento del calendario. Esto no se puede deshacer. Las cuentas de quién pagó qué se quedan como están.",
    cancelled: "Cancelaste el evento.",
    cancelledNotice: "Este evento se canceló.",
    cancelledNoticeBody: "El organizador lo canceló. Ya no va.",
    title: "Panel de organizador",
    heading: "Panel de organizador",
    subheading: "Solo tú ves esta pantalla. No compartas este link.",
    participantsSection: "Participantes",
    removeParticipant: "Quitar",
    removeConfirmTitle: "¿Quitar a esta persona?",
    removeConfirmBody: (name: string) =>
      `${name} pasa a la lista de bajados, marcado como removido. Si vuelve a responder, la marca desaparece.`,
    removeConfirmAction: "Sí, quitar",
    markPaid: "Marcar como pagado",
    markPending: "Marcar que debe",
    markWaived: "No le cobro",
    paymentMethodLabel: "Método",
    paymentMethodPlaceholder: "nequi, efectivo, transferencia",
    promote: "Subir al evento",
    /* El resultado de cada botón, dicho apenas termina: sin esto el tap se
       sentía como nada hasta que la lista cambiaba sola un segundo después. */
    toastPaid: "Pago registrado.",
    toastPending: "Marcado como pendiente.",
    toastWaived: "Ya no se le cobra.",
    toastPromoted: "Ya está en el evento.",
    toastRemoved: (name: string) => `${name} quedó como removido.`,
    promoteHelp: "Confírmale tú mismo. No subimos a nadie automáticamente.",
    slotOpenedTitle: "Se liberó un cupo",
    slotOpenedBody: (n: number) =>
      n === 1
        ? "Hay 1 cupo libre y alguien esperando. Súbelo tú para que se entere."
        : `Hay ${n} cupos libres y gente esperando. Súbelos tú para que se enteren.`,
    closeEvent: "Cerrar convocatoria al evento",
    closeEventHelp: "Congela las confirmaciones. Puedes reabrirla después.",
    reopenEvent: "Reabrir convocatoria al evento",
    closeConfirmTitle: "¿Cerrar la convocatoria?",
    closeConfirmBody:
      "Nadie más podrá decir si viene ni cambiar su respuesta. El evento sigue en pie y puedes reabrir la convocatoria cuando quieras.",
    reopenConfirmTitle: "¿Reabrir la convocatoria?",
    reopenConfirmBody:
      "Las respuestas vuelven a abrirse: la gente podrá confirmar o cambiar lo que dijo.",
    closing: "Cerrando…",
    reopening: "Reabriendo…",
    closedDone: "Convocatoria cerrada.",
    reopenedDone: "Convocatoria reabierta.",
    editEvent: "Editar evento",
    editNotYours:
      "Este evento está a nombre de otra cuenta, así que solo esa puede cambiar sus datos. Todo lo demás —pagos, invitaciones, lista de espera, cerrarlo— sí puedes hacerlo desde este link.",
    editEventSaved: "Cambios guardados.",
    currencyChanged: (currency: string) =>
      `El monto queda tal como está escrito, ahora en ${currency}. Revísalo antes de guardar.`,
    removingCostWithCollected: (collected: string) =>
      `Ya recibiste ${collected}. Si lo dejas sin costo, ese registro deja de verse — no se borra, y vuelve si le pones costo otra vez.`,
    shareSection: "Links",
    splitWarningTitle: "Ojo con las cuentas",
    splitWarningBody: (name: string, confirmed: string, current: string) =>
      `${name} ya pagó ${confirmed}, pero con el reparto actual le corresponden ${current}. Ajústalo con esa persona por fuera — la app no toca esa cifra sola.`,
    noParticipants: "Nadie se ha registrado todavía.",
    noParticipantsHelp: "Comparte el link de invitados para que empiecen a confirmar.",
  },

  share: {
    /*
      La invitación por defecto, como plantilla. Los marcadores van en inglés a
      propósito y en los dos idiomas: no son texto, son huecos que el editor
      inserta con botones rotulados en el idioma de quien escribe, y dejarlos
      fijos hace que una plantilla sobreviva a que su autor cambie la interfaz.
    */
    defaultMessage: "¡Parcero! {title} — {when}. Confirma si vienes acá: {link}",
    copyParticipantLink: "Copiar link de invitados",
    copyOrganizerLink: "Copiar mi link de organizador",
  },

  footer: {
    privacyLink: "Privacidad",
    termsLink: "Condiciones",

    /* Los encabezados de columna. Dos palabras cada uno: un pie con títulos
       largos deja de leerse como índice y empieza a leerse como contenido. */
    productHeading: "Producto",
    legalHeading: "Legal",
    contactHeading: "Contacto",
    howItWorksLink: "Cómo funciona",
    myApprovals: "Mis aprobaciones",
    socialHeading: "Síguenos",

    /* La línea bajo la marca. Dice qué es esto para quien cae en el pie de una
       página legal sin haber visto la portada. */
    blurb: "Organiza planes con tu gente y lleva la cuenta de quién ya pagó. Sin contraseñas, sin apps que instalar.",

    contactCta: "hello@vennet.dev",
    contactHelp: "Dudas, reclamos o para ejercer tus derechos.",
    /*
      La atribución del pie, en app y en correo, idéntica en ambos: «© <año>
      Junti by Vennet». Más corta que la línea legal que el manual de Vennet
      prescribe para sus propios productos, y sin el dominio — el enlace lo
      lleva la marca encima, y repetir la dirección debajo la nombraba dos
      veces en cuatro palabras.
    */
    legal: (year: number) => `© ${year} ${BRAND_NAME} by Vennet`,
    /** Nombre accesible del enlace que envuelve la marca. */
    vennetLabel: "Vennet",
  },

  /** Lo que sale por correo. Cada plantilla, junto a su asunto. */
  emails: {
  eventCancelled: {
    subject: (title: string) => `Se canceló: ${title}`,
    preview: (title: string) => `Se canceló ${title}`,
    heading: "Se canceló el evento",
    body: (title: string) => `${title} no se va a hacer. El organizador lo canceló.`,
    calendarNote: "Lo quitamos de tu calendario si lo habías agregado.",
    moneyNote:
      "Si ya le habías pagado, eso queda entre tú y quien organiza — Junti nunca movió esa plata, solo llevó la cuenta.",
    cta: "Ver el evento",
  },
    pendingApproval: {
      subject: (name: string) => `${name} mandó un comprobante`,
      preview: (name: string) => `${name} está esperando tu visto bueno.`,
      heading: "Tienes un comprobante por revisar",
      body: (name: string, event: string) =>
        `${name} subió su comprobante para ${event}. Hasta que lo apruebes, no cuenta como confirmado.`,
      alsoWaiting: (n: number) =>
        `Con este van ${n} esperando. Puedes aprobarlos todos de una en la cola.`,
      cta: "Ver la cola",
    },
    authLink: {
      signup: {
        subject: "Confirma tu correo para entrar a Junti",
        preview: "Un toque y quedas dentro.",
        heading: "Bienvenido a Junti",
        body: "Toca el botón para confirmar que este correo es tuyo. Con eso quedas dentro — no hay contraseña que inventar ni recordar.",
        cta: "Confirmar y entrar",
      },
      magiclink: {
        subject: "Tu link para entrar a Junti",
        preview: "Toca el botón y quedas dentro.",
        heading: "Entra a Junti",
        body: "Pediste entrar con tu correo. Toca el botón y listo, sin contraseña.",
        cta: "Entrar",
      },
      expiry: (minutes: number) =>
        `El link vence en ${minutes} minutos y sirve una sola vez. Si se te pasa, pide uno nuevo.`,
      ignore: "¿No fuiste tú? Ignora este correo. Sin tocar el link no pasa nada.",
    },
    eventCreated: {
      subject: (title: string) => `Tu evento «${title}» quedó listo`,
      preview: (title: string) => `Comparte el link de ${title} por WhatsApp.`,
      heading: "Tu evento está creado",
      body: "Este es el link que compartes con tus invitados. Con él dicen si vienen y ven quién debe cuánto.",
      cta: "Ver el evento",
    },
    rsvpConfirmed: {
      confirmed: {
        subject: (title: string) => `Quedaste en la lista de «${title}»`,
        preview: (title: string) => `Tu lugar en ${title} está confirmado.`,
        heading: "Estás en la lista",
        body: (title: string) => `Dijiste que vas a ${title}. Acá quedan los detalles.`,
      },
      waitlisted: {
        subject: (title: string) => `Quedaste en lista de espera de «${title}»`,
        preview: (title: string) => `El cupo de ${title} está lleno.`,
        heading: "Estás en lista de espera",
        body: (title: string) =>
          `El cupo de ${title} ya estaba lleno cuando respondiste. Si alguien cancela, el organizador te sube y te avisa.`,
      },
      yourShare: (amount: string) => `Te corresponden ${amount}.`,
      cta: "Ver el evento",
      changeNote: "¿Cambió el plan? Puedes cambiar tu respuesta desde el evento cuando quieras.",
    },
    settlementRequest: {
      subject: (title: string) => `Quedó un saldo pendiente en «${title}»`,
      preview: (title: string) => `La cuota de ${title} subió y falta un saldo tuyo.`,
      heading: "Quedó un saldo pendiente",
      body: (title: string) =>
        `En ${title} no se llenaron todos los cupos, así que el costo se repartió entre menos personas y la cuota por persona subió.`,
      numbers: (paid: string, share: string) =>
        `Pagaste ${paid} y la cuota final quedó en ${share}.`,
      missing: (amount: string) => `El saldo pendiente es ${amount}.`,
      cta: "Ver el evento",
      note: "El pago se coordina directo con el organizador, como siempre — Junti solo lleva la cuenta.",
    },
    eventInvitation: {
      subject: (organizer: string, event: string) => `${organizer} te invitó a ${event}`,
      preview: (organizer: string, event: string) => `${organizer} te está invitando a ${event}.`,
      heading: (organizer: string) => `${organizer} te invitó`,
      body: (event: string) =>
        `Te están invitando a ${event}. Mira los detalles y dinos si vienes — así el organizador sabe con cuántos contar.`,
      cta: "Ver el evento",
      accountNote:
        "Para confirmar necesitas entrar con tu cuenta. Es con Google o con un link a tu correo, sin contraseña.",
      unsubscribe: "¿No quieres recibir más invitaciones? Date de baja.",
    },
  },

  unsubscribe: {
    title: "Darte de baja",
    heading: "No te escribimos más",
    doneTitle: (email: string) => `Listo, ${email} queda fuera`,
    doneHelp:
      "No vas a recibir más invitaciones de Junti en esa dirección, de ningún evento ni de ningún organizador. Si te apuntas a algo por tu cuenta, los correos de esa participación sí siguen llegando.",
    badLinkTitle: "Ese link está incompleto",
    badLinkHelp:
      "Le falta la dirección de correo. Abre el link tal como venía en el mensaje, o escríbenos a hello@vennet.dev y te sacamos a mano.",
  },

  privacy: {
    title: "Aviso de privacidad",
    heading: "Cómo tratamos tus datos",
    intro:
      "En corto: guardamos lo mínimo para que el evento funcione, no vendemos nada, y puedes pedir que lo borremos cuando quieras.",
    responsibleTitle: "Quién responde",
    responsibleBody:
      "Junti es un producto de Vennet, operado por Iván Elías Ávila Almanza, persona natural domiciliada en Colombia, quien actúa como responsable del tratamiento. Para consultas, reclamos o para ejercer cualquiera de tus derechos, escribe a hello@vennet.dev. Respondemos consultas dentro de los diez días hábiles y reclamos dentro de los quince que fija la Ley 1581 de 2012.",
    dataTitle: "Qué guardamos",
    dataBody:
      "Tu correo, tu nombre, tu foto de perfil si entraste con Google, y tu número de WhatsApp solo si lo diste marcando la casilla. Si apartas cupos para tu gente, guardamos el nombre que escribas para cada cupo — solo el nombre, nunca un correo ni un teléfono: el link de invitación lo compartes tú directamente. Ese nombre se borra solo cuando el cupo se reclama o unos días después del evento, y la persona puede pedir su retiro en cualquier momento. Si activas los avisos en un dispositivo, guardamos la dirección técnica de entrega que crea tu navegador — no identifica el aparato ni sirve para otra cosa que mandarte tus propios avisos, y se borra al desactivarlos o cuando el navegador la invalida. De los eventos guardamos a qué te apuntaste, qué respondiste y si el organizador registró tu pago. Si aceptaste el link de un grupo, guardamos que estás en ese grupo — o que dijiste que no — para que quien lo organiza pueda invitarte a sus eventos.",
    purposesTitle: "Para qué",
    purposesBody:
      "El correo es cómo entras: no hay contraseña, te mandamos un link. El nombre es lo que ven los demás en la lista del evento. El teléfono existe para una sola cosa, y es que el organizador de un evento al que te apuntaste pueda escribirte por WhatsApp. Los grupos existen para que no tengamos que escribirle a nadie que no haya aceptado antes: solo recibes invitaciones de alguien cuyo grupo aceptaste, y puedes salirte cuando quieras.",
    /*
      Con nombre propio, no "proveedores de identidad": la verificación OAuth
      de Google exige que el aviso nombre los datos de Google que la app usa, y
      un usuario que entró con Google también merece la respuesta literal. La
      última frase importa a los dos lectores — usar Junti no obliga a Google.
    */
    googleTitle: "Si entras con Google",
    googleBody:
      "Al iniciar sesión con Google recibimos tu nombre, tu correo y tu foto de perfil — nada más. Los usamos para crear tu cuenta, mostrarte en las listas de tus eventos y avisarte de lo que pase en ellos. No pedimos acceso a tu calendario, a tus contactos ni a ningún otro dato de tu cuenta de Google, no usamos esa información para publicidad, y no se la mostramos a nadie por fuera de lo que describe este aviso. Puedes usar Junti sin Google, entrando con un link a tu correo.",
    sharingTitle: "Quién más lo ve",
    sharingBody:
      "El organizador de cada evento al que te apuntas ve tu nombre, tu respuesta y —si lo autorizaste— tu WhatsApp. Quien organiza un grupo que aceptaste ve tu nombre, nunca tu correo: cuando te invita, la dirección la leemos en ese momento y no se la mostramos. Los demás invitados ven tu nombre y tu respuesta, nunca tu correo ni tu teléfono. No compartimos tus datos con nadie más, no los vendemos, y no vamos a hacerlo: protegerlos es parte de lo que este producto promete.",
    processorsTitle: "Con qué herramientas",
    processorsBody:
      "Supabase guarda la base de datos y maneja el ingreso, en Canadá. Resend entrega los correos, en Estados Unidos. Vercel aloja la aplicación. Cada uno trata los datos solo por instrucción nuestra y para lo descrito aquí.",
    transferTitle: "Salida del país",
    transferBody:
      "Como esas herramientas están fuera de Colombia, tus datos se procesan en Canadá y Estados Unidos. Al usar Junti aceptas esa transferencia; si no estás de acuerdo, escríbenos y borramos tu cuenta.",
    rightsTitle: "Tus derechos",
    rightsBody:
      "Puedes pedir saber qué tenemos tuyo, corregirlo, actualizarlo o borrarlo, y revocar cualquier autorización que hayas dado. El WhatsApp lo revocas tú mismo desde tu perfil y el número se borra de inmediato. Para lo demás escribe a hello@vennet.dev y respondemos dentro de los plazos que fija la Ley 1581 de 2012.",
    retentionTitle: "Cuánto tiempo",
    retentionBody:
      "Mientras tengas cuenta. Si la borras, quitamos tus datos personales y dejamos solo lo que el evento necesita para que las cuentas de los demás sigan cuadrando. Los comprobantes de pago se borran en cuanto el organizador los aprueba: queda el registro de que pagaste, no la foto. Si el tuyo fue rechazado y quieres que lo borremos, escríbenos.",
    version: (v: string) => `Versión de este aviso: ${v}`,
  },

  /**
   * Las condiciones del servicio.
   *
   * Escritas en el mismo registro que el resto de la app — segunda persona,
   * frases cortas, sin latinajos — porque unas condiciones que nadie entiende
   * no informan a nadie, y el punto de tenerlas es que la persona sepa en qué
   * se está metiendo antes de meterse.
   *
   * La sección que más importa es la del dinero, y va de primera después de
   * qué es esto: Junti lleva la cuenta y NUNCA mueve un peso. Esa frase es la
   * frontera del producto y ya está en el código, en el aviso de privacidad y
   * en la landing; acá queda como promesa explícita.
   */
  terms: {
    title: "Condiciones del servicio",
    heading: "Las reglas del juego",
    intro:
      "En corto: Junti te ayuda a organizar planes y a llevar la cuenta de quién pagó. No movemos plata, no somos parte de lo que acuerdes con tu gente, y puedes irte cuando quieras.",

    whatTitle: "Qué es Junti",
    whatBody:
      "Junti es una herramienta para organizar planes entre conocidos: creas un evento, compartes un link, la gente dice si viene, y si el plan cuesta algo, la app reparte la cuenta y lleva el registro de quién ya pagó. Es un producto de Vennet, operado por Iván Elías Ávila Almanza. Usarlo es gratis. Al crear una cuenta o apuntarte a un evento aceptas estas condiciones.",

    moneyTitle: "Junti no mueve plata. Nunca.",
    moneyBody:
      "Esta es la regla más importante y no tiene excepciones. La app calcula cuánto le toca a cada quien y guarda si el organizador dio ese pago por recibido. Los pagos ocurren por fuera, directamente entre las personas: quien organiza recibe la plata en su cuenta, por el medio que ustedes acuerden. Junti no custodia fondos, no procesa pagos, no cobra comisión sobre nada y no hace reembolsos, porque nunca tuvo el dinero. Un pago marcado como recibido significa que el organizador dijo que lo recibió — no es un comprobante bancario ni una garantía nuestra.",

    betweenTitle: "Lo que acuerdes es entre ustedes",
    betweenBody:
      "Junti no es parte de tu evento. Que la cancha esté reservada, que el plan se haga, que alguien devuelva lo que debe o que el organizador cumpla lo que prometió son asuntos entre las personas involucradas. Si hay un desacuerdo sobre plata, sobre un cupo o sobre lo que pasó, se resuelve entre ustedes. Podemos mostrar lo que quedó registrado en la app, y eso es todo lo que podemos hacer.",

    accountTitle: "Tu cuenta",
    accountBody:
      "Necesitas ser mayor de edad para tener cuenta. Si apartas cupos para otras personas, respondes por esos cupos — el lugar y la plata — hasta que cada quien los reclame con su link, y el nombre que pongas debe ser de alguien que sabe que lo estás invitando. Se entra con Google o con un link a tu correo, así que cuidar tu correo es cuidar tu cuenta. Responde por lo que se haga desde ella. Usa un nombre por el que tu gente te reconozca: es lo que van a ver en la lista, y ponerle a propósito el nombre de otra persona es justamente lo que no se puede.",

    organizerTitle: "Si organizas",
    organizerBody:
      "Quien crea un evento responde por él: por la información que publica, por el cobro que define y por cumplir lo que ofreció. Solo puedes invitar a gente de un grupo tuyo — es decir, a personas que aceptaron un link tuyo — y eso es a propósito: nadie recibe correos de alguien a quien nunca le dijo que sí. El link de organizador delega el manejo del día, no la propiedad del evento: quien lo tenga puede marcar pagos e invitar, pero solo tú puedes editar los datos o cancelarlo.",

    contentTitle: "Lo que escribes",
    contentBody:
      "Lo que publiques en un evento —el nombre, las notas, lo que dices que vas a llevar— lo ven los demás invitados. Sigue siendo tuyo; solo lo mostramos donde tiene que aparecer para que el plan funcione. No publiques datos de otras personas sin que ellas lo sepan, ni nada ilegal, ofensivo o que no te pertenezca.",

    prohibitedTitle: "Lo que no se puede",
    prohibitedBody:
      "Usar Junti para mandar publicidad o mensajes masivos a gente que no aceptó tu grupo. Suplantar a alguien. Intentar entrar a eventos o cuentas que no son tuyas, o adivinar links ajenos. Automatizar el uso de la app de forma que la afecte para los demás. Usarla para actividades ilegales, o para cobrar por cosas que no puedes vender.",

    availabilityTitle: "Disponibilidad y garantías",
    availabilityBody:
      "Junti es un producto joven y gratuito, y se ofrece tal como está. Hacemos lo razonable para que funcione y para no perder tus datos, pero no prometemos que esté disponible siempre ni que esté libre de errores. Podemos cambiar o retirar funciones. Si algo importante cambia, lo avisamos por acá o por correo.",

    liabilityTitle: "Hasta dónde respondemos",
    liabilityBody:
      "Respondemos por lo que la ley colombiana nos obliga a responder, y no más. En particular, no respondemos por la plata que se muevan entre ustedes, por planes que no se hicieron, ni por lo que otra persona haga en un evento. Nada de esto limita los derechos que la ley te reconoce como consumidor ni los que tienes sobre tus datos personales, que están en el aviso de privacidad.",

    endingTitle: "Cerrar la cuenta",
    endingBody:
      "Puedes pedir que borremos tu cuenta cuando quieras, escribiendo a hello@vennet.dev. En el aviso de privacidad está exactamente qué se borra y qué se conserva anonimizado, y por qué: tu participación en eventos donde hubo plata de por medio es también el registro de otras personas. Nosotros podemos suspender una cuenta que esté haciendo algo de la lista de arriba, y avisamos cuando se pueda.",

    changesTitle: "Cambios a estas condiciones",
    changesBody:
      "Si cambian, la fecha de abajo cambia con ellas. Cuando el cambio sea de fondo lo avisamos antes de que aplique. Seguir usando la app después de eso es aceptar la versión nueva; si no estás de acuerdo, puedes cerrar tu cuenta.",

    lawTitle: "Ley aplicable",
    lawBody:
      "Estas condiciones se rigen por las leyes de la República de Colombia, y cualquier disputa se resuelve ante los jueces colombianos. Para cualquier cosa —dudas, reclamos, o para ejercer tus derechos— escribe a hello@vennet.dev.",

    privacyLink: "Lee también el aviso de privacidad",
    version: (v: string) => `Vigentes desde: ${v}`,
  },

  onboarding: {
    title: "Completa tu perfil",
    heading: "¿Cómo te llamas?",
    subheading: "Solo esto y quedas listo. Es lo que ven los demás en las listas.",
    nameLabel: "Nombre y apellido",
    nameHelp: "Así te van a reconocer tus amigos en la lista del evento.",
    namePlaceholder: "Ivan Avila",
    phoneLabel: "WhatsApp (opcional)",
    phoneHelp:
      "Para que el organizador de tus eventos pueda escribirte. No aparece en la lista pública ni lo ven los otros invitados.",
    phonePlaceholder: "300 123 4567",
    submit: "Listo, entrar",
    submitting: "Guardando…",
    errorNameRequired: "Escribe tu nombre.",
    errorNameTooLong: "Ese nombre es muy largo.",
    errorPhone: "Ese número no parece válido. Solo dígitos, con o sin indicativo.",
    consentLabel:
      "Autorizo que el organizador de los eventos a los que me apunte pueda escribirme por WhatsApp a este número.",
    consentHelp: "Sin esta autorización no guardamos el número. Puedes revocarla cuando quieras.",
    privacyLink: "Aviso de privacidad",
  },

  invites: {
    heading: "Invitar",
    help: (group: string) => `Elige a quién invitar de ${group}. Solo aparecen quienes ya aceptaron estar en el grupo.`,
    submit: (n: number) => (n === 1 ? "Invitar a 1" : `Invitar a ${n}`),
    submitting: "Enviando…",
    selectAll: "Seleccionar a todos",
    clearSelection: "Quitar selección",
    /** Quien invita, cuando se administra solo con el link y no hay sesión. */
    fromOrganizer: "El organizador",
    sent: (n: number) => (n === 1 ? "Enviamos 1 invitación." : `Enviamos ${n} invitaciones.`),
    skipped: (n: number) =>
      n === 1 ? "1 ya había respondido." : `${n} ya habían respondido, así que no les escribimos.`,
    failed: (n: number) =>
      n === 1 ? "1 no pudo salir." : `${n} no pudieron salir. Intenta de nuevo con esas.`,

    /*
      El estado que reemplazó a la caja de texto. Antes acá se escribían
      correos de gente que nunca había dicho que sí; ahora, si no hay grupo,
      no hay a quién invitar, y lo que toca es armar el grupo primero.
    */
    noGroupTitle: "Este evento no tiene grupo",
    noGroupHelp:
      "Las invitaciones salen desde un grupo: así solo le escribimos a gente que ya aceptó recibirlas. Crea uno, comparte el link y vuelve.",
    noGroupCta: "Ir a mis grupos",
    emptyGroupTitle: (group: string) => `Todavía nadie aceptó en ${group}`,
    emptyGroupHelp: "Comparte el link del grupo. Cuando alguien acepte, aparece acá.",
    allInvitedTitle: "Ya invitaste a todo el grupo",
    allInvitedHelp: "Cuando alguien más se una al grupo, lo vas a ver acá.",

    listHeading: "Invitados",
    listHelp: "Quién ya respondió y quién sigue sin contestar.",
    empty: "Todavía no has invitado a nadie.",
    answered: (name: string) => `Respondió como ${name}`,
    waiting: "Sin responder",
    resend: "Reenviar",
    resending: "Reenviando…",
    resent: "Se lo mandamos otra vez.",
    errorEmpty: "Elige al menos a una persona.",
    errorTooMany: (max: number, got: number) =>
      `Son ${got} personas y el máximo por envío es ${max}. Manda el resto en otra tanda.`,
    errorNotInGroup: "Alguien de esa selección ya no está en el grupo. Vuelve a cargar y prueba otra vez.",
    errorRateLimited: (max: number) =>
      `Ya enviaste muchas invitaciones en la última hora (el máximo es ${max}). Espera un rato y sigues.`,
    errorSendFailed: "No pudimos enviar la invitación. Intenta de nuevo.",
  },

  groups: {
    /*
      El vocabulario del feature. Un grupo es "gente que aceptó estar", no una
      lista de contactos: por eso en todos lados se habla de aceptar, salir y
      volver, y en ningún lado de agregar o quitar personas. El dueño del grupo
      no mete a nadie; comparte un link y la gente decide.
    */
    link: "Mis grupos",
    title: "Mis grupos",
    heading: "Mis grupos",
    subheading:
      "Un grupo es la gente que aceptó recibir tus invitaciones. Compartes el link una vez y después invitar a un evento es elegir de una lista.",

    emptyTitle: "Todavía no tienes grupos",
    emptyHelp:
      "Crea uno para la gente con la que sales seguido: el equipo de los jueves, la familia, la oficina. Compartes el link, aceptan, y los próximos eventos se invitan en dos clics.",

    createHeading: "Crear un grupo",
    nameLabel: "Nombre del grupo",
    namePlaceholder: "Fútbol de los jueves",
    nameHelp: (max: number) => `Máximo ${max} caracteres. Lo van a ver quienes reciban el link.`,
    create: "Crear grupo",
    creating: "Creando…",
    created: (name: string) => `Creaste ${name}. Comparte el link para que se unan.`,
    errorNameEmpty: "Ponle un nombre al grupo.",
    errorNameTooLong: (max: number) => `Ese nombre es muy largo. Máximo ${max} caracteres.`,

    memberCount: (n: number) => (n === 1 ? "1 persona" : `${n} personas`),
    memberCountEmpty: "Sin nadie todavía",
    capacity: (joined: number, max: number) => `${joined} de ${max}`,
    fullBadge: "Lleno",

    detailBack: "Volver a mis grupos",
    membersHeading: "Quién está",
    membersHelp: "Cada quien entró por su cuenta y puede salir cuando quiera.",
    membersEmptyTitle: "Nadie ha aceptado todavía",
    membersEmptyHelp: "Comparte el link de abajo. Quien acepte aparece acá.",
    statusJoined: "Está en el grupo",
    statusDeclined: "Dijo que no",
    /** Se muestra tal cual: el dueño ve nombres, nunca correos. */
    ownerBadge: "Tú",

    shareHeading: "Link para unirse",
    shareHelp: "Cualquiera con este link puede pedir entrar. Se vuelve miembro solo si acepta.",
    copyLink: "Copiar link",
    copied: "Copiado",

    deleteHeading: "Eliminar el grupo",
    deleteHelp:
      "Se borra el grupo y sus membresías. Los eventos que lo usaban se quedan como están, pero dejan de poder invitar desde acá.",
    delete: "Eliminar grupo",
    deleting: "Eliminando…",
    /* El título del diálogo pregunta; el cuerpo dice qué se pierde. */
    deleteConfirm: (name: string) => `¿Eliminar ${name}?`,
    deleteConfirmBody:
      "Se pierden las membresías: quien esté adentro tendría que volver a aceptar un link nuevo. Los eventos que lo usaban se quedan como están. Esto no se puede deshacer.",
    deleted: "Eliminaste el grupo.",

    /* La página del link: /g/:token */
    joinTitle: (name: string) => `Unirte a ${name}`,
    joinHeading: (name: string) => `${name}`,
    joinInvitedBy: (owner: string) => `${owner} te está invitando a su grupo.`,
    joinExplainer:
      "Si aceptas, esta persona va a poder invitarte a sus eventos sin pedirte el correo cada vez. Puedes salir cuando quieras.",
    joinAccept: "Aceptar",
    joinAccepting: "Aceptando…",
    joinDecline: "Ahora no",
    joinDeclining: "Guardando…",
    joinSignIn: "Entra para aceptar",
    joinSignInHelp: "Necesitas una cuenta para que el grupo sepa a quién invitar.",

    stateJoined: (name: string) => `Ya estás en ${name}.`,
    stateJoinedHelp: "Vas a ver sus eventos en tu agenda cuando te inviten.",
    stateDeclined: (name: string) => `Le dijiste que no a ${name}.`,
    stateDeclinedHelp: "Si cambias de opinión, puedes aceptar ahora.",
    stateOwner: "Este grupo es tuyo.",
    stateOwnerHelp: "Comparte el link para que otros se unan.",
    stateFull: (name: string) => `${name} está lleno.`,
    stateFullHelp: (max: number) =>
      `Un grupo admite hasta ${max} personas. Habla con quien lo organiza.`,
    stateNotFound: "Ese link de grupo no existe o ya no está.",

    leave: "Salir del grupo",
    leaving: "Saliendo…",
    leaveConfirm: (name: string) => `¿Salir de ${name}?`,
    leaveConfirmBody:
      "Dejarán de poder invitarte a sus eventos. Si cambias de opinión, con este mismo link puedes volver a entrar.",
    left: "Saliste del grupo.",
    rejoin: "Volver a entrar",

    /* En los formularios de evento. */
    eventFieldLabel: "Grupo",
    eventFieldHelp: "Desde acá invitas. Puedes dejarlo sin grupo y compartir solo el link.",
    eventFieldNone: "Sin grupo",
    eventFieldEmpty: "Todavía no tienes grupos. Crea uno para invitar con un clic.",
    eventFieldCreate: "Crear un grupo",
  },

  approvals: {
    link: "Aprobaciones",
    title: "Aprobaciones pendientes",
    heading: "Aprobaciones pendientes",
    subheading: "Comprobantes esperando tu visto bueno, en todos tus eventos.",
    emptyTitle: "Nada por revisar",
    emptyHelp: "Cuando alguien mande un comprobante, aparece acá.",
    selectAll: "Seleccionar todo",
    clearSelection: "Quitar selección",
    approveSelected: (n: number) => (n === 1 ? "Aprobar 1" : `Aprobar ${n}`),
    approving: "Aprobando…",
    approvedNotice: (n: number) =>
      n === 1 ? "Aprobaste 1 comprobante." : `Aprobaste ${n} comprobantes.`,
    nothingLeft: "Esos ya estaban resueltos.",
    openEvent: "Abrir el evento",
    expandReceipt: (name: string) => `Ver el comprobante de ${name} en grande`,
    receiptGone: "El comprobante ya no está.",
    noReceipt: "Sin imagen",
    waitingSince: (when: string) => `Desde ${when}`,
    rejectHint: "¿Vas a rechazar alguno? Se hace dentro del evento, con el motivo.",
  },

  /**
   * The in-app inbox.
   *
   * Every sentence is built here rather than stored, which is what lets
   * somebody switch language and find their whole history rewritten instead of
   * a Spanish archive under an English interface.
   *
   * Written in the third person and in the past, because that is what a
   * notification is: a report of something that already happened to somebody
   * else. The one exception is `paymentRecorded`, which is about the reader's
   * own money and would sound absurd narrated at them.
   */
  /** La oferta de instalar la app, en my-events. Ver InstallOffer. */
  install: {
    title: "Lleva Junti en tu celular",
    help: "Con la app en tu pantalla de inicio, tus eventos y avisos quedan a un toque.",
    button: "Instalar",
    howButton: "Cómo instalarla",
    iosTitle: "Instalar Junti en tu iPhone",
    iosStep1: "1 · Toca Compartir (el cuadrado con la flecha hacia arriba) en la barra de Safari.",
    iosStep2: "2 · Elige «Añadir a pantalla de inicio» y confirma.",
    iosNote: "Queda como una app: pantalla completa, con la chapa de Junti, y lista para recibir avisos.",
    dismiss: "No volver a mostrar",
  },

  notifications: {
    link: "Notificaciones",
    open: "Ver notificaciones",
    title: "Notificaciones",
    unread: (n: number) => (n === 1 ? "1 sin leer" : `${n} sin leer`),
    markAllRead: "Marcar todo como leído",
    more: "Ver más",
    emptyTitle: "Nada nuevo",
    emptyHelp: "Cuando alguien responda o cambie algo en tus eventos, te avisamos acá.",

    /** El canal push: activarlo y apagarlo POR DISPOSITIVO, desde el panel. */
    push: {
      enable: "Avisarme en este dispositivo",
      disable: "Ya no avisar en este dispositivo",
      help: "Te llega una notificación aunque Junti esté cerrado. Se activa por dispositivo y la quitas cuando quieras.",
      enabled: "Listo — este dispositivo recibe avisos.",
      disabled: "Este dispositivo ya no recibe avisos.",
      failed: "No se pudo activar. Intenta de nuevo.",
      denied:
        "Este navegador tiene los avisos de Junti bloqueados. Se desbloquean en la configuración del sitio, no desde acá.",
      iosInstallFirst:
        "En iPhone los avisos requieren instalar Junti: Compartir → «Añadir a pantalla de inicio», y actívalos desde la app instalada.",
    },

    /** What each type says. The event's own title goes on the line below. */
    types: {
      rsvpReceived: (name: string, attendance: string) => `${name}: ${attendance}`,
      approvalPending: (name: string) => `${name} mandó un comprobante`,
      paymentConfirmed: "Tu pago quedó registrado",
      paymentWaived: "El organizador te eximió del pago",
      eventUpdated: (fields: string) => `El organizador cambió ${fields}`,
      eventCancelled: "Se canceló el evento",
    },

    /**
     * What moved, for `eventUpdated`. Lowercase and article-first, because they
     * are read inside the sentence above and never on their own.
     */
    fields: {
      title: "el nombre",
      startsAt: "la fecha",
      location: "el lugar",
      capacity: "el cupo",
      rsvpDeadline: "el cierre de la convocatoria",
      cost: "el precio",
    },
  },

  messages: {
    link: "Mensajes",
    title: "Mensajes a invitados",
    heading: "Mensajes a invitados",
    subheading: "Lo que reciben los tuyos cuando compartes un evento.",
    invitationLabel: "Invitación por WhatsApp",
    invitationHelp:
      "Se abre en WhatsApp con este texto ya escrito. Puedes cambiarlo antes de enviarlo, y lo que guardes acá se usa en todos tus eventos.",
    insertLabel: "Insertar",
    placeholderTitle: "Título",
    placeholderWhen: "Fecha y hora",
    placeholderLink: "Enlace",
    previewLabel: "Así se ve",
    restore: "Volver al mensaje por defecto",
    saved: "Mensaje guardado.",
    /* Only used by somebody who has no events yet, so the preview still
       shows the shape of a real message. */
    sampleTitle: "Fútbol de los jueves",
    sampleWhen: "jue, 7 ago, 8:00 p. m. (Bogotá)",
    usingDefault: "Estás usando el mensaje por defecto.",
    errorEmpty: "Escribe el mensaje o vuelve al que trae la app.",
    errorMissingLink: "Falta el enlace: sin él, nadie puede confirmar. Insértalo donde quieras.",
    errorTooLong: (max: number) => `Máximo ${max} caracteres.`,
  },

  auth: {
    signInTitle: "Entrar",
    signInHeading: "Entra a Junti",
    signInSubheading: "Sin contraseña: con Google, o con un link que te mandamos al correo.",
    google: "Continuar con Google",
    emailLabel: "Tu correo",
    emailPlaceholder: "tu@correo.com",
    emailSubmit: "Enviarme un link",
    emailSending: "Enviando…",
    emailSent: (email: string) => `Revisa ${email}`,
    emailSentHelp:
      "Ábrelo desde este mismo dispositivo. Si es tu primera vez, el correo dice «confirma tu cuenta». Mira también en spam — y si no llega en un par de minutos, entra con Google, que es inmediato.",
    slowRetry: "Se demoró más de lo normal. Toca otra vez y debería salir de una.",
    emailRateLimited:
      "Se enviaron demasiados correos en la última hora. Espera un rato o entra con Google.",
    emailInvalid: "Escribe un correo válido.",
    signOut: "Salir",
    /** Solo lo ve el dueño del producto — la entrada a /funnel. */
    panelLink: "Panel del producto",
    failed: "No pudimos completar el ingreso. Intenta de nuevo.",
    linkWrongBrowser: "Abre el link donde lo pediste",
    linkWrongBrowserHelp:
      "El link solo funciona en el mismo navegador y el mismo dispositivo desde donde lo pediste. Si abriste el correo en otro lado, pide uno nuevo desde acá.",
    linkFailed: "Ese link ya no sirve",
    linkFailedHelp:
      "Cada link sirve una sola vez y vence a la hora. Pide uno nuevo, o entra con Google.",
    myEventsTitle: "Mis eventos",
    myEventsHeading: "Mis eventos",
    myEventsEmpty: "Todavía no has creado ningún evento.",
    myEventsEmptyHelp: "Cuando crees uno, aparecerá acá con su historial.",
    myEventsLink: "Mis eventos",
    /** Tu relación con cada evento, en la etiqueta de la tarjeta. */
    roles: {
      organizer: "Organizas",
      in: "Vas",
      out: "No vas",
      maybe: "Tal vez",
      waitlisted: "En espera",
      invited: "Sin responder",
    },
    openEvent: "Ver evento",
    pendingTitle: (n: number) =>
      n === 1 ? "Te invitaron a un evento" : `Te invitaron a ${n} eventos`,
    pendingHelp: "Ábrelos y di si vas. El organizador está esperando tu respuesta.",
    share: "Compartir",
    duplicate: "Duplicar",
    duplicateAndEdit: "Duplicar y editar",
    duplicating: "Duplicando…",
    duplicatedNotice: "Listo, lo duplicamos para la próxima semana.",
    duplicateExists: "Ya tienes un evento igual esa semana. Revisa la lista antes de crear otro.",
    duplicateFailed: "No pudimos duplicarlo. Intenta de nuevo.",
    nextWeekHint: (when: string) => `Quedaría el ${when}.`,
    createdOn: (date: string) => `Creado el ${date}`,
    manage: "Administrar",
    attendingCount: (n: number) => (n === 1 ? "1 confirmado" : `${n} confirmados`),
    signInToJoin: "Entra y te apuntas con un toque",
    searchPlaceholder: "Buscar evento…",
    searchLabel: "Buscar entre tus eventos",
    tabUpcoming: "Próximos",
    /* El segundo eje del filtro: mi papel en el evento, no su fecha. */
    whoAll: "Todos",
    whoOrganizing: "Organizo",
    whoJoined: "Me uní",
    /* La vista es una preferencia de lectura, no un filtro: mismas cartas,
       otra densidad. */
    viewCards: "Ver como tarjetas",
    viewList: "Ver como lista",
    tabPast: "Pasados",
    tabAll: "Todos",
    /*
      Singulares, para la insignia de una tarjeta. Las pestañas de arriba
      cuentan varios eventos y por eso van en plural; un evento solo no es
      "Pasados".
    */
    statusUpcoming: "Próximo",
    statusPast: "Pasado",
    /** Cuando el evento no tiene tipo en el catálogo: la banda igual necesita decir algo. */
    eventFallbackLabel: "Evento",
    newEventShort: "Nuevo",
    noMatches: (term: string) => `Ningún evento coincide con “${term}”.`,
    noUpcoming: "No tienes eventos próximos.",
    noUpcomingHelp: "Crea uno o mira los que ya pasaron.",
    noPast: "Todavía no has hecho ningún evento.",
    noPastHelp: "Los que ya pasaron van quedando acá.",
    moreParticipants: (n: number) => `+${n}`,
    participantsLabel: "Quiénes van",
    nobodyYet: "Nadie todavía",
    cardActionsLabel: (title: string) => `Opciones de ${title}`,
    menuLabel: "Mi cuenta",
  },

  appearance: {
    label: "Apariencia",
    light: "Claro",
    dark: "Oscuro",
    system: "El del sistema",
  },

  profile: {
    title: "Mi perfil",
    heading: "Mi perfil",
    subheading: "Cómo quieres ver el app. Solo aplica a lo tuyo.",
    link: "Mi perfil",
    languageLabel: "Idioma",
    languageAuto: "El de mi navegador",
    timeZoneLabel: "Zona horaria",
    currencyLabel: "Moneda",
    currencyHelp:
      "La moneda con la que arrancan tus eventos nuevos. Cada evento fija la suya al crearse.",
    currencyDefault: "Peso colombiano (COP)",
    timeZoneAuto: "La de mi dispositivo",
    timeZoneHelp:
      "Las horas de los eventos se te muestran en esta zona. Cuando el evento es en otra, verás también la hora del lugar.",
    autoHelp: (detected: string) => `Ahora mismo detectamos: ${detected}.`,
    save: "Guardar",
    saving: "Guardando…",
    saved: "Listo, guardado.",
    storedNotice: "Queda guardado en tu cuenta, así te sigue a cualquier dispositivo.",
  },

  errorBoundary: {
    title: "Algo se rompió",
    body: "No pudimos cargar esta pantalla. Puede ser una falla temporal de conexión con la base de datos.",
    retry: "Intentar de nuevo",
    home: "Ir al inicio",
  },

  errors: {
    titleRequired: "Ponle un nombre al evento.",
    titleTooLong: "El nombre es muy largo (máximo 120 caracteres).",
    startsAtRequired: "Elige el día.",
    startsAtTimeRequired: "Elige la hora.",
    startsAtInvalid: "Esa fecha no es válida.",
    capacityInvalid: "El cupo debe ser un número mayor que cero.",
    costRequired: "Escribe el monto.",
    currencyLocked:
      "No se puede cambiar la moneda: ya hay pagos confirmados en la moneda actual.",
    costInvalid: "El monto debe ser un número mayor o igual a cero.",
    nameRequired: "Escribe tu nombre.",
    nameTooLong: "Máximo 40 caracteres.",
    attendanceInvalid: "Elige si vienes, no vienes o tal vez.",
    notFound: "No encontramos eso.",
    forbidden: "Este link no tiene permiso para hacer eso.",
    rateLimited: "Vas muy rápido. Espera un momento y vuelve a intentar.",
    eventClosed: "El evento está cerrado.",
    rsvpDeadlinePassed: "La convocatoria ya cerró.",
    deadlineInPast: "Esa fecha ya pasó.",
    deadlineAfterStart: "La convocatoria tiene que cerrar antes de que empiece el evento.",
    timeZoneInvalid: "Esa zona horaria no existe.",
    policyLabelTooLong: "Máximo 60 caracteres.",
    policyTooMany: (max: number) => `Máximo ${max} requisitos por evento.`,
    evidenceRequired: "Adjunta la foto del comprobante.",
    evidenceTooLarge: (maxKb: number) =>
      `La imagen pesa demasiado (máximo ${maxKb} KB después de reducirla).`,
    evidenceWrongType: "Solo aceptamos imágenes JPG, PNG o WebP.",
    evidenceUnreadable: "No pudimos leer esa imagen. Intenta con otra foto.",
    notAllowed: "No puedes hacer eso.",
    signInRequired: "Entra a tu cuenta para hacer eso.",
  },
};

export type Copy = typeof es;
