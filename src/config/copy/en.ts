import { BRAND_NAME, BRAND_TAGLINE } from "../brand";
import type { Copy } from "./es";

/**
 * Every user-facing string, in English.
 *
 * Typed as `Copy`, so this file cannot drift from `es.ts`: a missing key, a
 * renamed one, or a function taking the wrong arguments is a build error.
 *
 * Translated rather than transliterated. Spanish here is informal and Colombian
 * — "¡Parcero!", "no perseguir a nadie" — and the English is written to land
 * the same way for someone organizing five-a-side with friends, not to mirror
 * the Spanish sentence structure.
 */
export const en: Copy = {
  localeName: "English",
  intlLocale: "en-US",

  brand: {
    name: BRAND_NAME,
    tagline: BRAND_TAGLINE,
  },

  common: {
    save: "Save",
    cancel: "Cancel",
    close: "Close",
    delete: "Delete",
    add: "Add",
    edit: "Edit",
    copy: "Copy",
    options: "Options",
    copied: "Copied!",
    loading: "Loading…",
    back: "Back",
    unknownError: "Something went wrong. Try again.",
    required: "This field is required",
    optional: "optional",
    language: "Language",
    changeLanguage: "Change language",
    noMatches: "No matches",
  },

  /** Labels for the breadcrumb trail and the header's account control. */
  nav: {
    breadcrumbLabel: "Where you are",
    home: "Home",
    newEvent: "New event",
    manage: "Organize",
    evidence: "Receipt",
    event: "Event",
    signIn: "Sign in",
    groups: "My groups",
    guestMenuLabel: "Sign in and preferences",
  },

  home: {
    title: `${BRAND_NAME} — organize without chasing anyone`,
    heading: BRAND_NAME,
    heroImageAlt: "A women\u2019s football team celebrating and taking a selfie on the pitch.",
    heroCardKicker: "Friday, 8:00 p.m.",
    heroCardTitle: "Friday football",
    heroCardPeople: ["Ana Torres", "Camilo R\u00edos", "Sara Villegas", "Nico"],
    heroCardCount: "8 of 10",
    heroCardPaid: "6 have paid",

    planStrip: [
      { src: "futsal", alt: "A five-a-side match on a neighbourhood pitch." },
      { src: "pizza-casa", alt: "A group of friends eating pizza in a living room." },
      { src: "bolos", alt: "Four friends holding bowling balls on a lane." },
      { src: "padel", alt: "Three padel players leaning on the net." },
      { src: "cocina", alt: "Several people cooking and serving in a kitchen." },
      { src: "brindis", alt: "Two people clinking bottles." },
    ],

    heroTitle: "One link.",
    heroTitleSecond: "And you know how many.",
    subheading: BRAND_TAGLINE,
    pitch:
      "Your guests open the link and answer. You watch the list fill up, and who has already paid you, live. No passwords, nothing to install.",
    cta: "Create an event",
    howItWorksTitle: "How it works",
    steps: [
      "You create the event and decide whether it costs anything.",
      "You share the guest link on WhatsApp.",
      "Everyone says whether they are in, out, or maybe.",
      "You tick off who has paid, from your organizer link.",
    ],
    disclaimer:
      "This app never moves money. It only keeps track of who paid — you collect the payments yourself, outside of it.",

    heroKicker: "Free · No passwords · Nothing to install",
    heroSecondary: "I already have an account",

    featuresTitle: "What it is for",
    featuresBody: "Three things you stop doing by hand from the first event on.",
    stepsImageAlt: "A group toasting around a long table on a terrace at night.",
    trustImageAlt: "Two friends talking and laughing outdoors.",
    features: [
      {
        title: "You know who is coming",
        body: "The list updates itself. Nobody has to answer a message that got lost among fifty others in the group chat.",
      },
      {
        title: "You know who has paid",
        body: "Junti splits the bill and keeps the record. No more \u201cI already transferred it\u201d with nobody able to check.",
      },
      {
        title: "Nobody installs anything",
        body: "Your guests open a link and answer. No account up front, no app to download just to play football.",
      },
    ],

    closingTitle: "Your next plan, without chasing anyone",
    closingBody: "It takes a minute to create the first one. If it does not suit you, you have lost nothing.",

    painTitle: "Any of these sound familiar?",
    painBody: "If you organize anything with more than three people, you have lived at least one.",
    pains: [
      {
        title: "\u201cI\u2019m in\u201d \u00d7 14, and you still do not know how many",
        body: "The group fills with loose replies between memes. At eleven at night you scroll up and count by hand.",
      },
      {
        title: "\u201cI already transferred it\u201d and nobody knows who is missing",
        body: "You keep the tally in your phone notes, or in your head. You end up covering the gap yourself.",
      },
      {
        title: "You end up chasing people in private",
        body: "Messaging one by one the people who never answered, to confirm something they already said in the group.",
      },
    ],

    differenceTitle: "Why you can trust your group to this",
    differenceBody: "Three decisions made on purpose, and all three are checkable.",
    differences: [
      {
        title: "Your money never passes through here",
        body: "Junti works out the split and keeps the record. The money is transferred to you directly, by whatever means you agree on. We hold nothing, take no cut, and could not withhold it if we wanted to.",
      },
      {
        title: "Nobody gets an email without saying yes first",
        body: "You can only invite people who accepted a link from you. There is no contact list to paste and no third-party address stored. Leaving takes one click.",
      },
      {
        title: "No passwords, nothing to install",
        body: "Sign in with Google or a link to your email. Your guests open the link and answer from wherever they are.",
      },
    ],

    statsTitle: "What has happened here so far",
    statsEvents: "events created",
    statsAnswers: "answers recorded",
    statsPayments: "payments marked",

    faqTitle: "What people ask",
    faqs: [
      {
        q: "What does it cost?",
        a: "Nothing. Junti is free and has no paid plans today. If that ever changes, you will hear about it before, not after.",
      },
      {
        q: "Does Junti receive my event\u2019s money?",
        a: "No, and it is not a temporary limitation \u2014 it is a product decision. The app splits the bill and records whether you considered a payment received. The money goes straight to you, outside the app.",
      },
      {
        q: "Do my guests have to create an account?",
        a: "Yes, to answer. It is what keeps their spot in their name rather than their phone\u2019s, lets them change their answer from another device, and stops anybody answering on their behalf. Sign-in is Google or a link to their email, no password.",
      },
      {
        q: "Who can see my phone number?",
        a: "Only the organizer of an event you joined, and only if you gave it by ticking the box. The other guests see your name and your answer, never your email or your phone.",
      },
      {
        q: "Can I delete my account?",
        a: "Whenever you want, by writing to hello@vennet.dev. The privacy notice sets out exactly what is deleted and what is kept anonymized, and why.",
      },
      {
        q: "What if the event is cancelled?",
        a: "You call it off from your panel: everybody who said they were coming gets an email and it is removed from their calendar. Recorded payments are not deleted \u2014 they are the only evidence the two of you have of who put in what.",
      },
    ],
  },

  createEvent: {
    wizard: {
      progress: (step: number, total: number) => `Step ${step} of ${total}`,
      stepTitle: {
        1: "What, when and where",
        2: "Who, and what they must do",
        3: "What it costs",
      } as Record<number, string>,
      next: "Next",
      back: "Back",
      draftFound: "You had an event creation form in progress. What would you like to do?",
      draftRestore: "Carry on with it",
      draftDiscard: "Start over",
    },
    title: "Create event",
    heading: "New event",
    subheading: "Takes a minute.",
    fields: {
      title: "What are you doing?",
      titlePlaceholder: "Thursday football",
      titleHelp: "This is what your guests will see.",
      kind: "Kind of event",
      startsAt: "When?",
      startsAtHelp: (zone: string) => `${zone} time.`,
      startsAtDatePlaceholder: "Pick a day",
      startsAtTimePlaceholder: "Time",
      startsAtDateLabel: "Day",
      startsAtTimeLabel: "Time",
      timeZone: "Time zone",
      timeZoneHelp:
        "The event time always shows in this zone, for everyone. Nobody has to do the maths.",
      location: "Where?",
      locationPlaceholder: "La 90 pitch, Medellín",
      capacity: "Maximum spots",
      capacityPlaceholder: "10",
      capacityHelp: "Leave it empty for no limit. Once it fills up, the rest join the waitlist.",
      rsvpLead: "Deadline to answer",
      rsvpLeadHelp:
        "How long people have to confirm. Counted back from the event, so moving the event moves the deadline with it.",
      rsvpLeadNone: "No deadline",
      rsvpLeadOptions: {
        2: "2 hours before",
        6: "6 hours before",
        24: "1 day before",
        48: "2 days before",
        72: "3 days before",
        168: "1 week before",
      },
      notes: "Notes",
      notesPlaceholder: "Bring a white shirt and boots.",
      costMode: "Does it cost anything?",
      costAmount: "Amount",
      costAmountHelpTotal: "Split evenly between everyone who says they are coming.",
      costAmountHelpPerPerson: "Everyone who confirms pays this much.",
      currency: "Currency",
    },
    costModes: {
      none: "Free",
      total: "One total to split",
      per_person: "A fixed amount each",
    },
    submit: "Create event",
    submitting: "Creating…",
  },

  eventCreated: {
    heading: "Done! Your event is live",
    subheading: "Save both links. They are the only way back in.",
    participantLinkLabel: "Guest link",
    participantLinkHelp:
      "This is the one you share. They say if they are coming and see who owes what.",
    organizerLinkLabel: "Your organizer link",
    organizerLinkHelp:
      "For someone helping you run the event. It is how they mark payments, invite people and close it.",
    organizerLinkNote:
      "You do not need to save it: the event lives in “My events” and you can always get back from there. Whoever receives this link has to sign in with their own account, and only you can edit the event's details.",
    shareWhatsApp: "Share on WhatsApp",
    goToManage: "Go to my organizer panel",
  },

  event: {
    closedBadge: "Closed",
    closedNotice: "This event is closed. Nobody can say they are coming or change their answer.",
    notFoundTitle: "We could not find this event",
    notFoundBody: "The link may be incomplete, or the event may have been deleted.",
    noLocation: "No place set",
    whenLabel: "When",
    inZone: (place: string) => `${place} time`,
    eventLocalTime: (when: string, place: string) => `In ${place}: ${when}`,
    whereLabel: "Where",
    notesLabel: "Notes",
    capacityLabel: "Spots",
    capacityUnlimited: "No limit",
    capacityValue: (taken: number, total: number) => `${taken} of ${total}`,
    spotsLeft: (n: number) => (n === 1 ? "1 spot left" : `${n} spots left`),
    full: "Full",
    addToCalendar: "Add to my calendar",
    addToCalendarHelp: "Downloads a file your calendar opens — Google, Apple, whichever you use.",

    convocationTitle: "Answers close in",
    convocationUrgentTitle: "Last hour to answer",
    convocationClosesAt: (when: string) => `Until ${when}`,
    convocationUnits: {
      day: (n: number) => (n === 1 ? "1 day" : `${n} days`),
      hour: (n: number) => `${n} h`,
      minute: (n: number) => `${n} min`,
      second: (n: number) => `${n} s`,
    },
    convocationClosedNotice: "The deadline to answer has passed.",
    convocationClosedBody:
      "Nobody can confirm or change their answer now. If you need to get in, talk to whoever is organizing.",

    preview: {
      title: "Preview",
      guestBody: "This is the page as somebody who has signed in and not answered yet sees it.",
      strangerBody: "This is the page as somebody opening the link with no account sees it.",
      guestWarning: "The buttons are live: if you confirm from here, you are on the list.",
      asGuest: "As a guest",
      asStranger: "With no account",
      viewAsGuest: "View as a guest",
      viewAsStranger: "View with no account",
      exit: "Leave the preview",
      sectionLabel: "See it the way they will",
      sectionHelp: "Before you send the link, check what the person opening it runs into.",
    },
  },

  roster: {
    heading: "Who is coming",
    inTitle: "Coming",
    outTitle: "Not coming",
    maybeTitle: "Maybe",
    waitlistedTitle: "Waitlist",
    empty: "Nobody has answered yet. Be the first.",
    emptyGroup: "Nobody here.",
    countIn: (n: number) => (n === 1 ? "1 person" : `${n} people`),
    pendingPolicyTitle: "Something still missing",
    pendingPolicyHelp:
      "They said they are coming, but have not met what the event asks for yet. They do not count as confirmed.",
    waitingOn: (labels: string) => `Waiting on: ${labels}`,
    inReview: (labels: string) => `Under review: ${labels}`,
  },

  attendance: {
    in: "In",
    out: "Out",
    maybe: "Maybe",
    waitlisted: "Waitlisted",
  },

  rsvp: {
    heading: "Let them know you are coming",
    headingEditing: "Change your answer",
    nameLabel: "Your name",
    namePlaceholder: "What your friends call you",
    nameHelp: "1 to 40 characters. Use the same one every time so you do not show up twice.",
    attendanceLabel: "Are you coming?",
    submit: "Confirm",
    submitEditing: "Update my answer",
    submitting: "Sending…",
    yourRsvp: (name: string) => `You are on the list as ${name}.`,
    changeMine: "Change my answer",
    saved: "Done — you are on the list.",
    savedEditing: "Your answer is updated.",
    waitlistedShort: "Done — you are on the waitlist.",
    waitlistedNotice:
      "The event is full, so you are on the waitlist. If someone drops out, the organizer will move you up and let you know.",
    willBeWaitlisted:
      "The event is full. If you choose “In”, you join the waitlist and the organizer moves you up if someone drops out.",
    duplicateName:
      "Someone with that name is already on this event. Use another one — add your surname, for instance.",
    closed: "The event is closed and no longer accepts changes.",
    oneTapHeading: "Join in one tap",
    oneTapSubmit: (name: string) => `I'm in — add me as ${name}`,
    oneTapSubmitting: "Adding you…",
    oneTapHelp: "One tap and you are on the list. You can change your answer afterwards.",
    oneTapNameTaken:
      "Someone on this event already has your name. Adjust it and we will add you just as fast.",
    signedInAs: (name: string) => `You are signed in as ${name}.`,
    useAnotherName: "I'd rather type a different name",
    signInHeading: (title: string) => `Sign in to join ${title}`,
    signInHelp:
      "Google or a link to your email, no password, and you land right back on this event.",
    signInBenefits: [
      "Your spot is held in your name, not your phone's.",
      "Change your answer from any phone, whenever you like.",
      "See what you owe and whether the organizer has marked it received.",
      "Every plan you join ends up in one place.",
    ],
    signInCta: "Sign in or create an account",
    signInAlreadyIn: "Already in:",
    signInAndMore: (n: number) => (n === 1 ? "and 1 more" : `and ${n} more`),
  },

  policies: {
    sectionTitle: "What it takes to be confirmed",
    sectionHelp:
      "Anyone who says they are coming but has not met these shows up separately, as pending. You decide which ones apply.",
    labelField: "What is it called?",
    descriptionField: "Instructions",
    customize: "Customise",
    maxReached: (max: number) => `You can ask for up to ${max} requirements per event.`,
    labelOverrideHelp: "Leave it empty to use the usual name.",
    descriptionOverrideHelp: "Leave it empty to use the usual instructions.",
    unsupported:
      "This version of the app does not know how to ask for this requirement. It blocks nobody; tell whoever administers the catalogue.",
    handlerHelp: {
      file_upload_reviewed: "They upload a photo and you approve it.",
      self_acknowledged: "They tick a box. Met immediately, with nothing for you to review.",
    } as Record<string, string>,
    status: {
      missing: "Pending",
      submitted: "Under review",
      approved: "Met",
      rejected: "Rejected",
    },
    yourStatusHeading: "What is left before you are confirmed",
    allDone: "All done. You are confirmed.",
    blockedNotice: (labels: string) =>
      `You are on the list, but not confirmed yet: ${labels} still missing.`,
    acknowledgeSubmit: "I confirm I have read it",
    acknowledged: "You have confirmed this.",
    uploadLabel: "Photo of the receipt",
    uploadHelp: "JPG, PNG or WebP. We shrink it on your phone before uploading.",
    uploadChoose: "Choose a photo",
    uploadChange: "Change photo",
    uploadSubmit: "Send receipt",
    uploadSubmitting: "Sending…",
    uploadPreparing: "Preparing the image…",
    noteLabel: "Note",
    noteHelp: "Optional. The transfer reference, for instance.",
    notePlaceholder: "Transfer 4471",
    submittedNotice: "Sent. The organizer will review it and confirm you.",
    rejectedNotice: (reason: string) => `The organizer did not accept it: ${reason}`,
    rejectedNoticeNoReason: "The organizer did not accept it. Send it again.",
    resubmit: "Send another",
    onlyOrganizerSeesEvidence:
      "Only the organizer sees this photo. It never appears on the public list.",
  },

  review: {
    heading: "To review",
    empty: "Nothing waiting to be reviewed.",
    pendingCount: (n: number) => (n === 1 ? "1 to review" : `${n} to review`),
    approve: "Approve",
    reject: "Reject",
    reasonLabel: "Why?",
    reasonPlaceholder: "Photo is unreadable, amount does not match…",
    reasonHelp: "We show this to them so they can send it again.",
    submittedBy: (name: string, when: string) => `${name} · sent ${when}`,
    approvedNotice: "Approved.",
    rejectedNotice: "Rejected. They can send it again now.",
    noEvidence: "No photo attached.",
    expandEvidence: (name: string) => `See ${name}’s receipt full size`,
    evidenceGone: "The receipt is no longer there.",
  },

  commitments: {
    heading: "Bringing anything?",
    help: "Tell the group what you are bringing. Everyone with the link sees it.",
    notePlaceholder: "I'll bring the ball",
    reactionLabel: "Or pick an emoji",
    save: "Post",
    saving: "Posting…",
    update: "Update",
    remove: "Delete mine",
    removeOne: "Delete",
    feedHeading: "Who is bringing what",
    feedEmpty: "Nobody has said what they are bringing yet. Be the first.",
    mustJoinFirst: "Tell us you are coming first.",
    errorEmpty: "Write something or pick an emoji.",
    errorTooLong: (max: number) => `${max} characters max.`,
    errorReaction: "That emoji is not available.",
    quickPicks: ["I'll bring the ball ⚽", "I'll bring the cake 🎂", "I'm on music 🥁", "I'll be there 🏃"],
  },

  money: {
    heading: "The money",
    owesLabel: "Owes",
    collectedLabel: "Collected",
    outstandingLabel: "Still owed",
    totalLabel: "Event total",
    perPersonLabel: "Each",
    /** The same fact beside a price, where the label has to share the line. */
    perPersonShort: "each",
    paid: "Paid",
    pending: "Owes",
    waived: "No charge",
    noCost: "This event is free.",
    /** The same fact as `noCost`, at the size of a label on a card. */
    free: "Free",
    splitAmong: (n: number) => (n === 1 ? "Split between 1 person" : `Split between ${n} people`),
    nobodyIn: "Nobody has confirmed yet, so there is nothing to split.",
    progressLabel: (collected: string, total: string) => `${collected} of ${total}`,
  },

  manage: {
    cancelHeading: "Cancel the event",
    cancelHelp:
      "Different from closing it. Closing freezes confirmations and the event still happens; cancelling says it is off, emails everyone who said they were coming, and removes it from their calendar.",
    cancel: "Cancel event",
    cancelling: "Cancelling…",
    cancelConfirm: (title: string) => `Cancel ${title}?`,
    cancelConfirmBody:
      "We email everyone who said they were coming and remove the event from their calendar. This cannot be undone. The record of who paid what stays exactly as it is.",
    cancelled: "You cancelled the event.",
    cancelledNotice: "This event was cancelled.",
    cancelledNoticeBody: "The organizer called it off. It is not happening.",
    title: "Organizer panel",
    heading: "Organizer panel",
    subheading: "Only you see this screen. Do not share this link.",
    participantsSection: "Participants",
    removeParticipant: "Remove",
    removeConfirmTitle: "Remove this person?",
    removeConfirmBody: (name: string) =>
      `${name} is removed from the event along with their payment record. This cannot be undone.`,
    removeConfirmAction: "Yes, remove",
    markPaid: "Mark as paid",
    markPending: "Mark as owing",
    markWaived: "Do not charge",
    paymentMethodLabel: "Method",
    paymentMethodPlaceholder: "cash, transfer, card",
    promote: "Move up to the event",
    promoteHelp: "Confirm them yourself. We never move anyone up automatically.",
    slotOpenedTitle: "A spot opened up",
    slotOpenedBody: (n: number) =>
      n === 1
        ? "There is 1 free spot and someone waiting. Move them up so they find out."
        : `There are ${n} free spots and people waiting. Move them up so they find out.`,
    closeEvent: "Close event",
    closeEventHelp: "Freezes the answers. You can reopen it later.",
    reopenEvent: "Reopen event",
    editEvent: "Edit event",
    editNotYours:
      "This event belongs to another account, so only that one can change its details. Everything else — payments, invitations, the waitlist, closing it — you can do from this link.",
    editEventSaved: "Changes saved.",
    currencyChanged: (currency: string) =>
      `The amount stays as written, now in ${currency}. Check it before saving.`,
    removingCostWithCollected: (collected: string) =>
      `You have already received ${collected}. Making this free hides that record — it is not deleted, and comes back if you set a cost again.`,
    shareSection: "Links",
    splitWarningTitle: "Careful with the numbers",
    splitWarningBody: (name: string, confirmed: string, current: string) =>
      `${name} already paid ${confirmed}, but the current split puts them at ${current}. Sort it out with them directly — the app will not change that figure on its own.`,
    noParticipants: "Nobody has signed up yet.",
    noParticipantsHelp: "Share the guest link so people can start answering.",
  },

  share: {
    /*
      The default invitation, as a template. The placeholders are English in
      both languages on purpose: they are not prose but slots, inserted by
      buttons labelled in the writer's own language, and keeping the token
      fixed lets a template survive its author switching the interface.
    */
    defaultMessage: "Hey! {title} — {when}. Let me know if you are coming: {link}",
    copyParticipantLink: "Copy guest link",
    copyOrganizerLink: "Copy my organizer link",
  },

  footer: {
    privacyLink: "Privacy",
    termsLink: "Terms",

    productHeading: "Product",
    legalHeading: "Legal",
    contactHeading: "Contact",
    howItWorksLink: "How it works",
    myApprovals: "My Approvals",
    socialHeading: "Follow us",

    blurb: "Organize plans with your people and keep track of who has paid. No passwords, nothing to install.",

    contactCta: "hello@vennet.dev",
    contactHelp: "Questions, complaints, or exercising your rights.",
    /*
      The footer attribution, identical in the app and in email: "© <year>
      Junti by Vennet". Shorter than the legal line Vennet's manual prescribes
      for its own products, and without the domain — the mark above carries the
      link, and repeating the address below named it twice in four words.
    */
    legal: (year: number) => `© ${year} ${BRAND_NAME} by Vennet`,
    /** Accessible name for the link wrapping the mark. */
    vennetLabel: "Vennet",
  },

  /** What goes out by email. Each template, beside its subject. */
  emails: {
  eventCancelled: {
    subject: (title: string) => `Cancelled: ${title}`,
    preview: (title: string) => `${title} was cancelled`,
    heading: "The event was cancelled",
    body: (title: string) => `${title} is not happening. The organizer cancelled it.`,
    calendarNote: "We removed it from your calendar if you had added it.",
    moneyNote:
      "If you had already paid them, that is between you and the organizer — Junti never moved that money, it only kept the count.",
    cta: "See the event",
  },
    pendingApproval: {
      subject: (name: string) => `${name} sent a receipt`,
      preview: (name: string) => `${name} is waiting on your go-ahead.`,
      heading: "You have a receipt to review",
      body: (name: string, event: string) =>
        `${name} uploaded their receipt for ${event}. Until you approve it, they do not count as confirmed.`,
      alsoWaiting: (n: number) =>
        `That makes ${n} waiting. You can approve them all at once from the queue.`,
      cta: "Open the queue",
    },
    authLink: {
      signup: {
        subject: "Confirm your email to join Junti",
        preview: "One tap and you are in.",
        heading: "Welcome to Junti",
        body: "Tap the button to confirm this address is yours. That is all it takes — there is no password to invent or remember.",
        cta: "Confirm and sign in",
      },
      magiclink: {
        subject: "Your link to sign in to Junti",
        preview: "Tap the button and you are in.",
        heading: "Sign in to Junti",
        body: "You asked to sign in with your email. Tap the button and you are in — no password.",
        cta: "Sign in",
      },
      expiry: (minutes: number) =>
        `The link expires in ${minutes} minutes and works once. If you miss it, ask for a new one.`,
      ignore: "Not you? Ignore this email. Nothing happens unless the link is opened.",
    },
    eventCreated: {
      subject: (title: string) => `Your event “${title}” is live`,
      preview: (title: string) => `Share the link to ${title} on WhatsApp.`,
      heading: "Your event is live",
      body: "This is the link you share with your guests. They use it to say if they are coming and to see who owes what.",
      cta: "See the event",
    },
    rsvpConfirmed: {
      confirmed: {
        subject: (title: string) => `You are on the list for “${title}”`,
        preview: (title: string) => `Your spot at ${title} is confirmed.`,
        heading: "You are on the list",
        body: (title: string) => `You said you are coming to ${title}. Here are the details.`,
      },
      waitlisted: {
        subject: (title: string) => `You are on the waitlist for “${title}”`,
        preview: (title: string) => `${title} is full.`,
        heading: "You are on the waitlist",
        body: (title: string) =>
          `${title} was already full when you answered. If somebody drops out, the organizer moves you up and lets you know.`,
      },
      yourShare: (amount: string) => `Your share is ${amount}.`,
      cta: "See the event",
      changeNote: "Plans changed? You can change your answer from the event whenever you like.",
    },
    eventInvitation: {
      subject: (organizer: string, event: string) => `${organizer} invited you to ${event}`,
      preview: (organizer: string, event: string) => `${organizer} is inviting you to ${event}.`,
      heading: (organizer: string) => `${organizer} invited you`,
      body: (event: string) =>
        `You are invited to ${event}. Have a look and let them know if you are coming — that is how the organizer knows who to count on.`,
      cta: "See the event",
      accountNote:
        "You will need to sign in to confirm. Google or a link to your email, no password.",
      unsubscribe: "Would rather not get invitations? Unsubscribe.",
    },
  },

  unsubscribe: {
    title: "Unsubscribe",
    heading: "We will not write again",
    doneTitle: (email: string) => `Done — ${email} is off the list`,
    doneHelp:
      "No more Junti invitations will reach that address, from any event or any organizer. If you join something yourself, the emails for that participation still arrive.",
    badLinkTitle: "That link is incomplete",
    badLinkHelp:
      "It is missing the email address. Open the link exactly as it came in the message, or write to hello@vennet.dev and we will remove you by hand.",
  },

  privacy: {
    title: "Privacy notice",
    heading: "How we handle your data",
    intro:
      "The short version: we keep the minimum the event needs, we sell nothing, and you can ask us to delete it whenever you like.",
    responsibleTitle: "Who is responsible",
    responsibleBody:
      "Junti is a Vennet product, operated by Iván Elías Ávila Almanza, an individual based in Colombia, who acts as the data controller. For questions, complaints, or to exercise any of your rights, write to hello@vennet.dev. We answer questions within ten business days and complaints within fifteen, as Colombia's Ley 1581 de 2012 requires.",
    dataTitle: "What we keep",
    dataBody:
      "Your email, your name, and your WhatsApp number only if you gave it by ticking the box. For events we keep which ones you joined, what you answered, and whether the organizer recorded your payment. If you accepted a group link, we keep that you are in that group — or that you said no — so whoever runs it can invite you to their events.",
    purposesTitle: "What for",
    purposesBody:
      "Email is how you get in: there is no password, we send you a link. Your name is what everyone else sees on the event's list. The phone number exists for exactly one thing — so the organizer of an event you joined can reach you on WhatsApp. Groups exist so that we never write to anybody who has not agreed first: you only get invitations from someone whose group you accepted, and you can leave whenever you want.",
    sharingTitle: "Who else sees it",
    sharingBody:
      "The organizer of each event you join sees your name, your answer and — if you allowed it — your WhatsApp. Whoever runs a group you accepted sees your name, never your email: when they invite you, the address is read at that moment and never shown to them. Other guests see your name and your answer, never your email or your phone. We do not share your data with anyone else, we do not sell it, and we will not: protecting it is part of what this product promises.",
    processorsTitle: "Which tools",
    processorsBody:
      "Supabase holds the database and handles sign-in, in Canada. Resend delivers the email, in the United States. Vercel hosts the application. Each processes data only on our instructions and only for what is described here.",
    transferTitle: "Leaving the country",
    transferBody:
      "Because those tools sit outside Colombia, your data is processed in Canada and the United States. Using Junti means accepting that transfer; if you would rather not, write to us and we will delete your account.",
    rightsTitle: "Your rights",
    rightsBody:
      "You can ask what we hold, correct it, update it or delete it, and withdraw any permission you gave. WhatsApp you can withdraw yourself from your profile, and the number is deleted immediately. For anything else write to hello@vennet.dev and we answer within the periods set by Colombia's Ley 1581 de 2012.",
    retentionTitle: "For how long",
    retentionBody:
      "While you have an account. If you delete it we remove your personal data and keep only what the event needs so everyone else's numbers still add up. Payment receipts are deleted the moment the organizer approves them: what remains is the record that you paid, not the photo. If yours was rejected and you want it removed, write to us.",
    version: (v: string) => `Version of this notice: ${v}`,
  },

  terms: {
    title: "Terms of service",
    heading: "The rules of the game",
    intro:
      "In short: Junti helps you organize plans and keep track of who paid. We never move money, we are not a party to whatever you agree with your people, and you can leave whenever you want.",

    whatTitle: "What Junti is",
    whatBody:
      "Junti is a tool for organizing plans among people who know each other: you create an event, share a link, people say whether they are coming, and if the plan costs something, the app splits the bill and keeps track of who has paid. It is a Vennet product, operated by Iván Elías Ávila Almanza. Using it is free. Creating an account or joining an event means accepting these terms.",

    moneyTitle: "Junti never moves money. Ever.",
    moneyBody:
      "This is the most important rule and it has no exceptions. The app works out what each person owes and records whether the organizer considers that payment received. Payments happen outside, directly between people: whoever organizes receives the money in their own account, by whatever means you agree on. Junti holds no funds, processes no payments, takes no cut of anything and issues no refunds, because it never had the money. A payment marked as received means the organizer said they received it — it is not a bank receipt and not a guarantee from us.",

    betweenTitle: "Whatever you agree is between you",
    betweenBody:
      "Junti is not a party to your event. Whether the pitch is actually booked, whether the plan happens, whether somebody pays back what they owe, or whether the organizer delivers what they promised are matters between the people involved. If there is a disagreement about money, about a spot, or about what happened, you settle it between yourselves. We can show what was recorded in the app, and that is all we can do.",

    accountTitle: "Your account",
    accountBody:
      "You need to be of legal age to have an account. You sign in with Google or a link to your email, so looking after your email is looking after your account. You are responsible for what happens from it. Use a name your people recognize: it is what they will see on the list, and deliberately using somebody else's name is exactly what is not allowed.",

    organizerTitle: "If you organize",
    organizerBody:
      "Whoever creates an event is responsible for it: for the information they publish, for the cost they set, and for delivering what they offered. You can only invite people from one of your groups — that is, people who accepted a link from you — and that is deliberate: nobody receives email from somebody they never said yes to. The organizer link delegates running the day, not ownership: whoever holds it can mark payments and invite, but only you can edit the details or cancel it.",

    contentTitle: "What you write",
    contentBody:
      "What you post on an event — your name, the notes, what you say you are bringing — is visible to the other guests. It stays yours; we only show it where it has to appear for the plan to work. Do not post other people's details without their knowledge, and nothing illegal, offensive, or that is not yours.",

    prohibitedTitle: "What you cannot do",
    prohibitedBody:
      "Use Junti to send advertising or bulk messages to people who never accepted your group. Impersonate somebody. Try to reach events or accounts that are not yours, or guess other people's links. Automate the app in ways that degrade it for everybody else. Use it for illegal activity, or to charge for things you cannot sell.",

    availabilityTitle: "Availability and warranties",
    availabilityBody:
      "Junti is a young, free product and is offered as it is. We do what is reasonable to keep it working and not to lose your data, but we do not promise it will always be available or free of bugs. We may change or withdraw features. If something important changes, we will say so here or by email.",

    liabilityTitle: "How far our responsibility goes",
    liabilityBody:
      "We are responsible for what Colombian law requires us to be responsible for, and no further. In particular, we are not responsible for money you move between yourselves, for plans that did not happen, or for what another person does at an event. None of this limits the rights the law gives you as a consumer, or your rights over your personal data, which are in the privacy notice.",

    endingTitle: "Closing your account",
    endingBody:
      "You can ask us to delete your account whenever you want, by writing to hello@vennet.dev. The privacy notice sets out exactly what is deleted and what is kept anonymized, and why: your participation in events where money was involved is also other people's record. We may suspend an account doing any of the things listed above, and we will say so where we can.",

    changesTitle: "Changes to these terms",
    changesBody:
      "If they change, the date below changes with them. When a change is substantial we will say so before it applies. Continuing to use the app after that means accepting the new version; if you disagree, you can close your account.",

    lawTitle: "Governing law",
    lawBody:
      "These terms are governed by the laws of the Republic of Colombia, and any dispute is settled before Colombian courts. For anything at all — questions, complaints, or exercising your rights — write to hello@vennet.dev.",

    privacyLink: "Read the privacy notice too",
    version: (v: string) => `In force since: ${v}`,
  },

  onboarding: {
    title: "Complete your profile",
    heading: "What is your name?",
    subheading: "Just this and you are set. It is what everyone else sees on the lists.",
    nameLabel: "Full name",
    nameHelp: "This is how your friends will recognise you on the event's list.",
    namePlaceholder: "Ivan Avila",
    phoneLabel: "WhatsApp (optional)",
    phoneHelp:
      "So the organizer of your events can reach you. It never shows on the public list and other guests cannot see it.",
    phonePlaceholder: "300 123 4567",
    submit: "Done, take me in",
    submitting: "Saving…",
    errorNameRequired: "Enter your name.",
    errorNameTooLong: "That name is too long.",
    errorPhone: "That number does not look right. Digits only, with or without a country code.",
    consentLabel: "I allow the organizer of events I join to reach me on WhatsApp at this number.",
    consentHelp: "Without this we do not store the number at all. You can withdraw it any time.",
    privacyLink: "Privacy notice",
  },

  invites: {
    heading: "Invite",
    help: (group: string) => `Pick who to invite from ${group}. Only people who accepted the group show up here.`,
    submit: (n: number) => (n === 1 ? "Invite 1" : `Invite ${n}`),
    submitting: "Sending…",
    selectAll: "Select everyone",
    clearSelection: "Clear selection",
    /** Who is inviting, when managing by link with no session. */
    fromOrganizer: "The organizer",
    sent: (n: number) => (n === 1 ? "Sent 1 invitation." : `Sent ${n} invitations.`),
    skipped: (n: number) =>
      n === 1 ? "1 had already answered." : `${n} had already answered, so we left them alone.`,
    failed: (n: number) =>
      n === 1 ? "1 could not be sent." : `${n} could not be sent. Try those again.`,

    /*
      The state that replaced the textarea. This used to be where an organizer
      typed the addresses of people who had never agreed to anything; now, with
      no group there is nobody to invite, and the thing to do is build the
      group first.
    */
    noGroupTitle: "This event has no group",
    noGroupHelp:
      "Invitations go out through a group, so we only ever write to people who agreed to hear from you. Create one, share the link, and come back.",
    noGroupCta: "Go to my groups",
    emptyGroupTitle: (group: string) => `Nobody has accepted ${group} yet`,
    emptyGroupHelp: "Share the group link. As people accept, they show up here.",
    allInvitedTitle: "You have invited the whole group",
    allInvitedHelp: "When somebody else joins the group, you will see them here.",

    listHeading: "Invited",
    listHelp: "Who answered, and who has not.",
    empty: "You have not invited anyone yet.",
    answered: (name: string) => `Answered as ${name}`,
    waiting: "No answer yet",
    resend: "Send again",
    resending: "Sending…",
    resent: "Sent it again.",
    errorEmpty: "Pick at least one person.",
    errorTooMany: (max: number, got: number) =>
      `That is ${got} people and the most per send is ${max}. Send the rest in another batch.`,
    errorNotInGroup: "Someone in that selection is no longer in the group. Reload and try again.",
    errorRateLimited: (max: number) =>
      `You have sent a lot of invitations in the last hour (the most is ${max}). Give it a while.`,
    errorSendFailed: "We could not send the invitation. Try again.",
  },

  groups: {
    /*
      The feature's vocabulary. A group is "people who agreed to be here", not
      a contact list: hence accept, leave and come back everywhere, and add or
      remove nobody. The owner never puts a person in — they share a link and
      the person decides.
    */
    link: "My groups",
    title: "My groups",
    heading: "My groups",
    subheading:
      "A group is the people who agreed to hear from you. Share the link once, and inviting them to an event becomes picking from a list.",

    emptyTitle: "No groups yet",
    emptyHelp:
      "Make one for the people you see often: the Thursday team, the family, the office. Share the link, they accept, and every event after that is two clicks.",

    createHeading: "Create a group",
    nameLabel: "Group name",
    namePlaceholder: "Thursday football",
    nameHelp: (max: number) => `Up to ${max} characters. Everyone with the link sees it.`,
    create: "Create group",
    creating: "Creating…",
    created: (name: string) => `Created ${name}. Share the link so people can join.`,
    errorNameEmpty: "Give the group a name.",
    errorNameTooLong: (max: number) => `That name is too long. Up to ${max} characters.`,

    memberCount: (n: number) => (n === 1 ? "1 person" : `${n} people`),
    memberCountEmpty: "Nobody yet",
    capacity: (joined: number, max: number) => `${joined} of ${max}`,
    fullBadge: "Full",

    detailBack: "Back to my groups",
    membersHeading: "Who is in",
    membersHelp: "Everyone joined on their own, and can leave whenever they want.",
    membersEmptyTitle: "Nobody has accepted yet",
    membersEmptyHelp: "Share the link below. Whoever accepts shows up here.",
    statusJoined: "In the group",
    statusDeclined: "Said no",
    /** Shown as-is: the owner sees names, never addresses. */
    ownerBadge: "You",

    shareHeading: "Join link",
    shareHelp: "Anyone with this link can ask to join. They are only a member if they accept.",
    copyLink: "Copy link",
    copied: "Copied",

    deleteHeading: "Delete the group",
    deleteHelp:
      "The group and its memberships go away. Events that used it stay as they are, but can no longer invite from here.",
    delete: "Delete group",
    deleting: "Deleting…",
    /* The dialog title asks; the body says what is lost. */
    deleteConfirm: (name: string) => `Delete ${name}?`,
    deleteConfirmBody:
      "The memberships go with it: everybody inside would have to accept a new link. Events that used it stay as they are. This cannot be undone.",
    deleted: "Group deleted.",

    /* The link page: /g/:token */
    joinTitle: (name: string) => `Join ${name}`,
    joinHeading: (name: string) => `${name}`,
    joinInvitedBy: (owner: string) => `${owner} is inviting you to their group.`,
    joinExplainer:
      "If you accept, they can invite you to their events without asking for your email each time. You can leave whenever you want.",
    joinAccept: "Accept",
    joinAccepting: "Accepting…",
    joinDecline: "Not now",
    joinDeclining: "Saving…",
    joinSignIn: "Sign in to accept",
    joinSignInHelp: "You need an account so the group knows who to invite.",

    stateJoined: (name: string) => `You are in ${name}.`,
    stateJoinedHelp: "Their events will show up in your agenda when they invite you.",
    stateDeclined: (name: string) => `You said no to ${name}.`,
    stateDeclinedHelp: "If you change your mind, you can accept now.",
    stateOwner: "This group is yours.",
    stateOwnerHelp: "Share the link so others can join.",
    stateFull: (name: string) => `${name} is full.`,
    stateFullHelp: (max: number) => `A group holds up to ${max} people. Talk to whoever runs it.`,
    stateNotFound: "That group link does not exist any more.",

    leave: "Leave group",
    leaving: "Leaving…",
    leaveConfirm: (name: string) => `Leave ${name}?`,
    leaveConfirmBody:
      "They will not be able to invite you to their events. If you change your mind, this same link lets you back in.",
    left: "You left the group.",
    rejoin: "Join again",

    /* On the event forms. */
    eventFieldLabel: "Group",
    eventFieldHelp: "This is who you invite from. You can leave it off and just share the link.",
    eventFieldNone: "No group",
    eventFieldEmpty: "No groups yet. Make one to invite with a click.",
    eventFieldCreate: "Create a group",
  },

  approvals: {
    link: "Approvals",
    title: "Pending approvals",
    heading: "Pending approvals",
    subheading: "Receipts waiting on you, across every event of yours.",
    emptyTitle: "Nothing to review",
    emptyHelp: "When somebody sends a receipt, it shows up here.",
    selectAll: "Select all",
    clearSelection: "Clear selection",
    approveSelected: (n: number) => (n === 1 ? "Approve 1" : `Approve ${n}`),
    approving: "Approving…",
    approvedNotice: (n: number) =>
      n === 1 ? "You approved 1 receipt." : `You approved ${n} receipts.`,
    nothingLeft: "Those were already resolved.",
    openEvent: "Open the event",
    expandReceipt: (name: string) => `See ${name}’s receipt full size`,
    receiptGone: "The receipt is no longer there.",
    noReceipt: "No image",
    waitingSince: (when: string) => `Since ${when}`,
    rejectHint: "Rejecting one? That happens inside the event, with the reason.",
  },

  notifications: {
    link: "Notifications",
    open: "See notifications",
    title: "Notifications",
    unread: (n: number) => (n === 1 ? "1 unread" : `${n} unread`),
    markAllRead: "Mark all as read",
    more: "See more",
    emptyTitle: "Nothing new",
    emptyHelp: "When somebody answers or something changes on your events, you will hear about it here.",

    types: {
      rsvpReceived: (name: string, attendance: string) => `${name}: ${attendance}`,
      approvalPending: (name: string) => `${name} sent a receipt`,
      paymentConfirmed: "Your payment is on the record",
      paymentWaived: "The organizer waived your payment",
      eventUpdated: (fields: string) => `The organizer changed ${fields}`,
      eventCancelled: "The event was cancelled",
    },

    fields: {
      title: "the name",
      startsAt: "the date",
      location: "the place",
      capacity: "the capacity",
      rsvpDeadline: "the deadline to answer",
      cost: "the price",
    },
  },

  messages: {
    link: "Messages",
    title: "Guest messages",
    heading: "Guest messages",
    subheading: "What yours receive when you share an event.",
    invitationLabel: "WhatsApp invitation",
    invitationHelp:
      "WhatsApp opens with this already written. You can change it before sending, and whatever you save here is used for every event you share.",
    insertLabel: "Insert",
    placeholderTitle: "Title",
    placeholderWhen: "Date and time",
    placeholderLink: "Link",
    previewLabel: "How it looks",
    restore: "Back to the default message",
    saved: "Message saved.",
    /* Only used by somebody who has no events yet, so the preview still
       shows the shape of a real message. */
    sampleTitle: "Thursday football",
    sampleWhen: "Thu, 7 Aug, 8:00 pm (Bogotá)",
    usingDefault: "You are using the default message.",
    errorEmpty: "Write the message, or go back to the one the app ships.",
    errorMissingLink: "The link is missing: without it nobody can reply. Put it wherever you like.",
    errorTooLong: (max: number) => `${max} characters maximum.`,
  },

  auth: {
    signInTitle: "Sign in",
    signInHeading: "Sign in to Junti",
    signInSubheading: "No password: use Google, or a link we email you.",
    google: "Continue with Google",
    emailLabel: "Your email",
    emailPlaceholder: "you@email.com",
    emailSubmit: "Email me a link",
    emailSending: "Sending…",
    emailSent: (email: string) => `Check ${email}`,
    emailSentHelp:
      "Open it on this same device. If this is your first time, the message says “confirm your email”. Check spam too — and if nothing arrives in a couple of minutes, use Google, which is instant.",
    slowRetry: "That took longer than usual. Tap again and it should go straight through.",
    emailRateLimited: "Too many emails went out in the last hour. Wait a while, or use Google.",
    emailInvalid: "Enter a valid email address.",
    signOut: "Sign out",
    failed: "We could not complete the sign-in. Try again.",
    linkWrongBrowser: "Open the link where you asked for it",
    linkWrongBrowserHelp:
      "The link only works in the same browser, on the same device, that asked for it. If you opened the email somewhere else, request a new one here.",
    linkFailed: "That link no longer works",
    linkFailedHelp:
      "Each link works once and expires after an hour. Request a new one, or use Google.",
    myEventsTitle: "My events",
    myEventsHeading: "My events",
    myEventsEmpty: "You have not created any events yet.",
    myEventsEmptyHelp: "Once you create one, it shows up here with its history.",
    myEventsLink: "My events",
    /** How you relate to each event, as the card's badge. */
    roles: {
      organizer: "Organizing",
      in: "Going",
      out: "Not going",
      maybe: "Maybe",
      waitlisted: "Waitlisted",
      invited: "No answer yet",
    },
    openEvent: "Open event",
    pendingTitle: (n: number) =>
      n === 1 ? "You were invited to an event" : `You were invited to ${n} events`,
    pendingHelp: "Open them and say whether you are coming. The organizer is waiting.",
    share: "Share",
    duplicate: "Duplicate",
    duplicateAndEdit: "Duplicate and edit",
    duplicating: "Duplicating…",
    duplicatedNotice: "Done — duplicated for next week.",
    duplicateExists:
      "You already have the same event that week. Check the list before creating another.",
    duplicateFailed: "We could not duplicate it. Try again.",
    nextWeekHint: (when: string) => `It would land on ${when}.`,
    createdOn: (date: string) => `Created on ${date}`,
    manage: "Manage",
    attendingCount: (n: number) => (n === 1 ? "1 confirmed" : `${n} confirmed`),
    signInToJoin: "Sign in and join in one tap",
    searchPlaceholder: "Search events…",
    searchLabel: "Search your events",
    tabUpcoming: "Upcoming",
    tabPast: "Past",
    tabAll: "All",
    /*
      Singular, for the badge on one card. The tabs above count several events
      and are plural for that reason; one event is not "Past events".
    */
    statusUpcoming: "Upcoming",
    statusPast: "Past",
    /** When the event has no catalogue type: the band still has to say something. */
    eventFallbackLabel: "Event",
    newEventShort: "New",
    noMatches: (term: string) => `No event matches “${term}”.`,
    noUpcoming: "You have no upcoming events.",
    noUpcomingHelp: "Create one, or look at the ones already done.",
    noPast: "You have not run any events yet.",
    noPastHelp: "Once one is over it stays here.",
    moreParticipants: (n: number) => `+${n}`,
    participantsLabel: "Who is coming",
    nobodyYet: "Nobody yet",
    cardActionsLabel: (title: string) => `Options for ${title}`,
    menuLabel: "My account",
  },

  appearance: {
    label: "Appearance",
    light: "Light",
    dark: "Dark",
    system: "Match my system",
  },

  profile: {
    title: "My profile",
    heading: "My profile",
    subheading: "How you want to see the app. It only affects your own view.",
    link: "My profile",
    languageLabel: "Language",
    languageAuto: "Whatever my browser uses",
    timeZoneLabel: "Time zone",
    currencyLabel: "Currency",
    currencyHelp:
      "The currency your new events start in. Each event fixes its own when created.",
    currencyDefault: "Colombian peso (COP)",
    timeZoneAuto: "Whatever my device uses",
    timeZoneHelp:
      "Event times are shown to you in this zone. When an event is somewhere else, you also see the local time there.",
    autoHelp: (detected: string) => `Right now we detect: ${detected}.`,
    save: "Save",
    saving: "Saving…",
    saved: "Saved.",
    storedNotice: "Kept on your account, so it follows you to any device.",
  },

  errorBoundary: {
    title: "Something broke",
    body: "We could not load this screen. It may be a temporary problem reaching the database.",
    retry: "Try again",
    home: "Go home",
  },

  errors: {
    titleRequired: "Give the event a name.",
    titleTooLong: "That name is too long (120 characters max).",
    startsAtRequired: "Pick a day.",
    startsAtTimeRequired: "Pick a time.",
    startsAtInvalid: "That date is not valid.",
    capacityInvalid: "Spots must be a number greater than zero.",
    costRequired: "Enter the amount.",
    currencyLocked:
      "The currency cannot change: there are confirmed payments in the current one.",
    costInvalid: "The amount must be zero or more.",
    nameRequired: "Enter your name.",
    nameTooLong: "40 characters max.",
    attendanceInvalid: "Choose whether you are in, out, or maybe.",
    notFound: "We could not find that.",
    forbidden: "This link is not allowed to do that.",
    rateLimited: "Too fast. Wait a moment and try again.",
    eventClosed: "The event is closed.",
    rsvpDeadlinePassed: "The deadline to answer has passed.",
    deadlineInPast: "That moment has already passed.",
    deadlineAfterStart: "The deadline has to close before the event starts.",
    timeZoneInvalid: "That time zone does not exist.",
    policyLabelTooLong: "60 characters max.",
    policyTooMany: (max: number) => `${max} requirements per event, maximum.`,
    evidenceRequired: "Attach a photo of the receipt.",
    evidenceTooLarge: (maxKb: number) =>
      `That image is too heavy (${maxKb} KB max after shrinking).`,
    evidenceWrongType: "We only accept JPG, PNG or WebP images.",
    evidenceUnreadable: "We could not read that image. Try a different photo.",
    notAllowed: "You cannot do that.",
    signInRequired: "Sign in to do that.",
  },
};
