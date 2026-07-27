import { BRAND_NAME, BRAND_TAGLINE } from "./brand";

/**
 * Every user-facing string in the app, in Spanish (es-CO).
 *
 * Code, identifiers and comments are English; only what a human reads lives
 * here. Keeping it in one module means the UI language can be swapped by
 * replacing this file — no i18n library, no extraction step, no runtime cost.
 *
 * Functions are used where a string needs interpolation, so callers never
 * build sentences by concatenation.
 */
export const copy = {
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
    copied: "¡Copiado!",
    loading: "Cargando…",
    back: "Volver",
    unknownError: "Algo salió mal. Intenta de nuevo.",
    required: "Este campo es obligatorio",
    optional: "opcional",
  },

  home: {
    title: `${BRAND_NAME} — organiza sin perseguir a nadie`,
    heading: BRAND_NAME,
    subheading: BRAND_TAGLINE,
    pitch:
      "Crea el evento, comparte el link por WhatsApp y mira en tiempo real quién viene y quién ya te pagó. Sin cuentas, sin contraseñas.",
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
  },

  createEvent: {
    title: "Crear evento",
    heading: "Nuevo evento",
    subheading: "Solo toma un minuto. No necesitas crear una cuenta.",
    fields: {
      title: "¿Qué van a hacer?",
      titlePlaceholder: "Fútbol de los jueves",
      titleHelp: "Así lo verán tus invitados.",
      kind: "Tipo de evento",
      startsAt: "¿Cuándo?",
      startsAtHelp: "Hora de Colombia (America/Bogotá).",
      startsAtDatePlaceholder: "Elige el día",
      startsAtTimePlaceholder: "Hora",
      startsAtDateLabel: "Día",
      startsAtTimeLabel: "Hora",
      location: "¿Dónde?",
      locationPlaceholder: "Cancha La 90, Medellín",
      capacity: "Cupo máximo",
      capacityPlaceholder: "10",
      capacityHelp:
        "Déjalo vacío si no hay límite. Al llenarse, los demás entran en lista de espera.",
      notes: "Notas",
      notesPlaceholder: "Llevar camiseta blanca y guayos.",
      costMode: "¿Tiene costo?",
      costAmount: "Monto",
      costAmountHelpTotal: "Se reparte en partes iguales entre quienes confirmen que vienen.",
      costAmountHelpPerPerson: "Cada persona que confirme paga este monto.",
      currency: "Moneda",
    },
    kinds: {
      match: "Partido",
      party: "Fiesta",
      kids_party: "Fiesta infantil",
      other: "Otro",
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
      "Este es el que compartes. Deja confirmar asistencia y ver quién debe cuánto.",
    organizerLinkLabel: "Tu link de organizador",
    organizerLinkHelp:
      "Guárdalo bien y no lo compartas. Con él marcas pagos, agregas gente y cierras el evento.",
    warning:
      "No hay cuentas ni recuperación de acceso. Si pierdes el link de organizador, pierdes el control del evento. Guárdalo en tus notas o mándatelo por WhatsApp.",
    shareWhatsApp: "Compartir por WhatsApp",
    goToManage: "Ir a mi panel de organizador",
  },

  event: {
    closedBadge: "Cerrado",
    closedNotice: "Este evento está cerrado. Ya no se puede confirmar ni cambiar asistencia.",
    notFoundTitle: "No encontramos este evento",
    notFoundBody: "El link puede estar incompleto o el evento pudo haber sido eliminado.",
    noLocation: "Sin lugar definido",
    whenLabel: "Cuándo",
    whereLabel: "Dónde",
    notesLabel: "Notas",
    capacityLabel: "Cupo",
    capacityUnlimited: "Sin límite",
    capacityValue: (taken: number, total: number) => `${taken} de ${total}`,
    spotsLeft: (n: number) => (n === 1 ? "Queda 1 cupo" : `Quedan ${n} cupos`),
    full: "Cupo lleno",
  },

  roster: {
    heading: "Quién viene",
    inTitle: "Vienen",
    outTitle: "No vienen",
    maybeTitle: "Tal vez",
    waitlistedTitle: "Lista de espera",
    empty: "Todavía nadie ha confirmado. Sé el primero.",
    emptyGroup: "Nadie por aquí.",
    countIn: (n: number) => (n === 1 ? "1 persona" : `${n} personas`),
  },

  attendance: {
    in: "Voy",
    out: "No voy",
    maybe: "Tal vez",
    waitlisted: "En espera",
  },

  rsvp: {
    heading: "Confirma tu asistencia",
    headingEditing: "Cambia tu respuesta",
    nameLabel: "Tu nombre",
    namePlaceholder: "Cómo te dicen tus amigos",
    nameHelp: "Entre 1 y 40 caracteres. Úsalo igual cada vez para no aparecer dos veces.",
    attendanceLabel: "¿Vienes?",
    submit: "Confirmar",
    submitEditing: "Actualizar mi respuesta",
    submitting: "Enviando…",
    yourRsvp: (name: string) => `Estás registrado como ${name}.`,
    changeMine: "Cambiar mi respuesta",
    waitlistedNotice:
      "El cupo está lleno, así que quedaste en lista de espera. Si alguien cancela, el organizador te avisa y te sube.",
    duplicateName:
      "Ya hay alguien con ese nombre en este evento. Usa otro (por ejemplo, agrega tu apellido).",
    closed: "El evento está cerrado y ya no acepta cambios.",
  },

  money: {
    heading: "Cuentas",
    owesLabel: "Debe",
    collectedLabel: "Recaudado",
    outstandingLabel: "Pendiente",
    totalLabel: "Total del evento",
    perPersonLabel: "Por persona",
    paid: "Pagó",
    pending: "Pendiente",
    waived: "Exonerado",
    noCost: "Este evento no tiene costo.",
    splitAmong: (n: number) =>
      n === 1 ? "Repartido entre 1 persona" : `Repartido entre ${n} personas`,
    nobodyIn: "Nadie ha confirmado todavía, así que aún no hay nada que repartir.",
    progressLabel: (collected: string, total: string) => `${collected} de ${total}`,
  },

  manage: {
    title: "Panel de organizador",
    heading: "Panel de organizador",
    subheading: "Solo tú ves esta pantalla. No compartas este link.",
    participantsSection: "Participantes",
    addParticipant: "Agregar a alguien",
    addParticipantHelp: "Para el amigo que nunca abre los links.",
    addParticipantSubmit: "Agregar",
    removeParticipant: "Quitar",
    removeConfirmTitle: "¿Quitar a esta persona?",
    removeConfirmBody: (name: string) =>
      `Se elimina a ${name} del evento junto con su registro de pago. Esto no se puede deshacer.`,
    removeConfirmAction: "Sí, quitar",
    markPaid: "Marcar como pagado",
    markPending: "Marcar como pendiente",
    markWaived: "Exonerar",
    paymentMethodLabel: "Método",
    paymentMethodPlaceholder: "nequi, efectivo, transferencia",
    promote: "Subir al evento",
    promoteHelp: "Confírmale tú mismo. No subimos a nadie automáticamente.",
    slotOpenedTitle: "Se liberó un cupo",
    slotOpenedBody: (n: number) =>
      n === 1
        ? "Hay 1 cupo libre y alguien esperando. Súbelo tú para que se entere."
        : `Hay ${n} cupos libres y gente esperando. Súbelos tú para que se enteren.`,
    closeEvent: "Cerrar evento",
    closeEventHelp: "Congela las confirmaciones. Puedes reabrirlo después.",
    reopenEvent: "Reabrir evento",
    editEvent: "Editar evento",
    editEventSaved: "Cambios guardados.",
    shareSection: "Links",
    splitWarningTitle: "Ojo con las cuentas",
    splitWarningBody: (name: string, confirmed: string, current: string) =>
      `${name} ya pagó ${confirmed}, pero con el reparto actual le corresponden ${current}. Ajústalo con esa persona por fuera — la app no toca esa cifra sola.`,
    noParticipants: "Nadie se ha registrado todavía.",
    noParticipantsHelp: "Comparte el link de invitados para que empiecen a confirmar.",
  },

  share: {
    whatsAppMessage: (title: string, when: string, url: string) =>
      `¡Parcero! ${title} — ${when}. Confirma si vienes acá: ${url}`,
    copyParticipantLink: "Copiar link de invitados",
    copyOrganizerLink: "Copiar mi link de organizador",
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
    costInvalid: "El monto debe ser un número mayor o igual a cero.",
    nameRequired: "Escribe tu nombre.",
    nameTooLong: "Máximo 40 caracteres.",
    attendanceInvalid: "Elige si vienes, no vienes o tal vez.",
    notFound: "No encontramos eso.",
    forbidden: "Este link no tiene permiso para hacer eso.",
    rateLimited: "Vas muy rápido. Espera un momento y vuelve a intentar.",
    eventClosed: "El evento está cerrado.",
  },
} as const;
