"use client";

import { useState } from "react";

import { Alert, AlertDescription, AlertTitle } from "@stackmyth/alert";
import { Badge } from "@stackmyth/badge";
import { Button } from "@stackmyth/button";
import { Card, CardContent, CardHeader, CardTitle } from "@stackmyth/card";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@stackmyth/dialog";
import { EmptyState } from "@stackmyth/empty-state";
import { Field, FieldDescription, FieldLabel } from "@stackmyth/field";
import { CalendarIcon, UserIcon } from "@stackmyth/icons";
import { Input } from "@stackmyth/input";
import { Container, Divider, Flex, Stack } from "@stackmyth/layout";
import {
  List,
  ListItem,
  ListItemContent,
  ListItemTitle,
  ListItemValue,
} from "@stackmyth/list-item";
import { Progress } from "@stackmyth/progress";
import { Skeleton } from "@stackmyth/skeleton";
import { RadioGroup, RadioGroupItem } from "@stackmyth/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@stackmyth/select";
import { Spinner } from "@stackmyth/spinner";
import { Stat } from "@stackmyth/stat";
import { Text } from "@stackmyth/text";
import { Textarea } from "@stackmyth/textarea";

import { MessageForm } from "@/app/messages/message-form";
import { EventList, type EventListItem } from "@/app/my-events/event-list";
import { useCopy } from "@/components/copy-provider";
import { Disclosure } from "@/components/disclosure";
import { GuestMenu } from "@/components/guest-menu";
import { LanguageCombobox } from "@/components/language-combobox";
import { ProfileMenu } from "@/components/profile-menu";
import { LOCALES, getCopy } from "@/config/copy";
import { paletteIndexFor } from "@/lib/palette";

/**
 * Three events covering what the card has to say: upcoming and priced, a
 * second of the same kind so the shared band colour is visible, and one that
 * has happened and was free.
 *
 * Everything arrives pre-formatted because that is how the real page sends it
 * — dates and money are rendered on the server, where the language and the
 * event's zone live.
 */
const SMOKE_EVENTS: EventListItem[] = [
  {
    id: "smoke-1",
    title: "Fútbol de los jueves",
    when: "jue, 7 ago, 8:00 p. m.",
    startsAtMs: Date.parse("2026-08-07T20:00:00-05:00"),
    isPast: false,
    location: "Cancha La 90",
    typeLabel: "Partido",
    cost: "$ 25.000",
    costPerPerson: true,
    isClosed: false,
    colorIndex: paletteIndexFor("match"),
    attendingCount: 8,
    firstAttendees: ["Camila", "Andrés", "Juli"],
    managePath: "#",
    whatsAppUrl: "#",
  },
  {
    id: "smoke-2",
    title: "Fútbol de los jueves",
    when: "jue, 14 ago, 8:00 p. m.",
    startsAtMs: Date.parse("2026-08-14T20:00:00-05:00"),
    isPast: false,
    location: "Cancha La 90",
    typeLabel: "Partido",
    cost: "$ 25.000",
    costPerPerson: true,
    isClosed: true,
    colorIndex: paletteIndexFor("match"),
    attendingCount: 12,
    firstAttendees: ["Sara", "Nico"],
    managePath: "#",
    whatsAppUrl: "#",
  },
  {
    id: "smoke-3",
    title: "Cumpleaños de Mati",
    when: "sáb, 12 jul, 3:00 p. m.",
    startsAtMs: Date.parse("2026-07-12T15:00:00-05:00"),
    isPast: true,
    location: null,
    typeLabel: "Fiesta infantil",
    cost: "Gratis",
    costPerPerson: false,
    isClosed: false,
    colorIndex: paletteIndexFor("kids_party"),
    attendingCount: 0,
    firstAttendees: [],
    managePath: "#",
    whatsAppUrl: "#",
  },
];

/**
 * Renders one of each primitive the app will actually use. If this page looks
 * right at 390px, the stack is usable; if a component is missing a prop or
 * blows up the layout, that is a gap and belongs in STACKMYTH-GAPS.md.
 */
export function SmokeClient() {
  const { copy } = useCopy();
  const [name, setName] = useState("");
  const [answer, setAnswer] = useState("in");
  const [kind, setKind] = useState("match");
  const [smokeLocale, setSmokeLocale] = useState("auto");

  return (
    <Container size="1">
      <Stack gap="lg" py="6" px="4">
        <Stack gap="1">
          <Text variant="h1">Stackmyth smoke test</Text>
          <Text variant="small" color="muted">
            Throwaway page. Delete once the real screens exist.
          </Text>
        </Stack>

        {/* Badges — every attendance and payment state the roster will show. */}
        <Flex gap="2" wrap="wrap">
          <Badge variant="success">Viene</Badge>
          <Badge variant="error" soft>
            No viene
          </Badge>
          <Badge variant="warning" soft>
            Tal vez
          </Badge>
          <Badge variant="secondary">En espera</Badge>
          <Badge variant="info" dot>
            Pagó
          </Badge>
        </Flex>

        {/* Buttons — sizes and variants used across the app. */}
        <Flex gap="2" wrap="wrap" align="center">
          <Button size="md">Primario</Button>
          <Button size="md" variant="secondary">
            Secundario
          </Button>
          <Button size="sm" variant="outline">
            Outline
          </Button>
          <Button size="sm" variant="ghost">
            Ghost
          </Button>
          <Button size="sm" variant="destructive" soft>
            Quitar
          </Button>
          <Button size="sm" loading>
            Cargando
          </Button>
        </Flex>

        <Button fullWidth size="lg">
          Botón de ancho completo
        </Button>

        <Divider />

        {/* Form — the exact composition the create-event and RSVP forms use. */}
        <Card surface="outlined">
          <CardHeader>
            <CardTitle>Formulario</CardTitle>
          </CardHeader>
          <CardContent>
            <Stack gap="4">
              <Field>
                <FieldLabel htmlFor="smoke-name">Tu nombre</FieldLabel>
                <Input
                  id="smoke-name"
                  fullWidth
                  size="lg"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Cómo te dicen tus amigos"
                />
                <FieldDescription>Entre 1 y 40 caracteres.</FieldDescription>
              </Field>

              <Field>
                <FieldLabel htmlFor="smoke-kind">Tipo</FieldLabel>
                <Select value={kind} onValueChange={setKind} id="smoke-kind">
                  <SelectTrigger fullWidth size="lg">
                    <SelectValue placeholder="Elige uno" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="match">Partido</SelectItem>
                    <SelectItem value="party">Fiesta</SelectItem>
                    <SelectItem value="kids_party">Fiesta infantil</SelectItem>
                    <SelectItem value="other">Otro</SelectItem>
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="smoke-when">Cuándo</FieldLabel>
                <Input
                  id="smoke-when"
                  type="datetime-local"
                  fullWidth
                  size="lg"
                  prefix={<CalendarIcon size={16} />}
                />
              </Field>

              <Field>
                <FieldLabel>¿Vienes?</FieldLabel>
                <RadioGroup value={answer} onValueChange={setAnswer} orientation="vertical">
                  <Flex as="label" gap="2" align="center">
                    <RadioGroupItem value="in" />
                    <Text as="span">Voy</Text>
                  </Flex>
                  <Flex as="label" gap="2" align="center">
                    <RadioGroupItem value="out" />
                    <Text as="span">No voy</Text>
                  </Flex>
                  <Flex as="label" gap="2" align="center">
                    <RadioGroupItem value="maybe" />
                    <Text as="span">Tal vez</Text>
                  </Flex>
                </RadioGroup>
              </Field>

              <Field>
                <FieldLabel htmlFor="smoke-notes">Notas</FieldLabel>
                <Textarea
                  id="smoke-notes"
                  fullWidth
                  rows={3}
                  placeholder="Llevar camiseta blanca."
                />
              </Field>
            </Stack>
          </CardContent>
        </Card>

        {/* Stats + progress — the money summary. */}
        <Flex gap="3" wrap="wrap">
          <Stat label="Recaudado" value="$ 120.000" />
          <Stat label="Pendiente" value="$ 80.000" />
        </Flex>
        <Progress value={60} max={100} aria-label="Recaudado" showLabel="above" />

        <Divider />

        {/* List — the roster. */}
        <List as="ul" divided>
          <ListItem>
            <ListItemContent>
              <ListItemTitle>Camila</ListItemTitle>
            </ListItemContent>
            <ListItemValue>
              <Badge variant="success" size="sm">
                Pagó
              </Badge>
            </ListItemValue>
          </ListItem>
          <ListItem>
            <ListItemContent>
              <ListItemTitle>Andrés</ListItemTitle>
            </ListItemContent>
            <ListItemValue>
              <Badge variant="warning" size="sm" soft>
                Pendiente
              </Badge>
            </ListItemValue>
          </ListItem>
        </List>

        <EmptyState
          icon={<UserIcon size={28} />}
          title="Nadie ha confirmado"
          description="Comparte el link para que empiecen a responder."
          action={<Button size="sm">Copiar link</Button>}
        />

        <Alert variant="warning" soft>
          <AlertTitle>Cupo lleno</AlertTitle>
          <AlertDescription>Quedaste en lista de espera.</AlertDescription>
        </Alert>

        {/* Modal — used for destructive confirmations. */}
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Abrir modal</Button>
          </DialogTrigger>
          <DialogContent size="sm" placement="center">
            <DialogHeader>
              <DialogTitle>¿Quitar a esta persona?</DialogTitle>
            </DialogHeader>
            <DialogBody>
              <Text>Se elimina del evento junto con su registro de pago.</Text>
            </DialogBody>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="secondary">Cancelar</Button>
              </DialogClose>
              <Button variant="destructive">Sí, quitar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Skeleton — the loading placeholder used by loading.tsx. */}
        <Stack gap="2">
          <Skeleton width="60%" height="24px" borderRadius="var(--sm-radius-md)" />
          <Skeleton width="100%" height="16px" borderRadius="var(--sm-radius-sm)" />
          <Skeleton width="40%" height="16px" borderRadius="var(--sm-radius-sm)" />
        </Stack>

        <Flex gap="2" align="center">
          <Spinner size="sm" />
          <Text variant="small" color="muted">
            Cargando…
          </Text>
        </Flex>

        <Divider />

        {/*
          The account drawer, in both states.

          It is a drawer whether or not there is a session — only the contents
          differ — and neither state is reachable from a page you can just open:
          the signed-out one needs no session, the signed-in one needs a real
          one, and no single page shows both. So both live here, which is what
          this page is for.

          The organizer below is fabricated on purpose. Nothing in the drawer
          reads a session; the header decides which of the two to render and
          hands the account down as props, so a literal exercises the same code
          the app runs.
        */}
        <Stack gap="3">
          <Text variant="h3">Account drawer</Text>
          <Text variant="small" color="muted">
            A top sheet at the full height of the screen on a phone, a 416px panel on the right from
            768px up. Signed out offers sign-in, language and appearance; signed in offers the
            destinations, language, appearance and sign-out.
          </Text>
          <Flex gap="3" wrap="wrap" align="center">
            <GuestMenu theme={null} />
            <ProfileMenu
              organizer={{
                displayName: "Ivan Avila",
                email: "ivan@vennet.dev",
                avatarUrl: null,
              }}
              theme={null}
            />
          </Flex>
        </Stack>

        {/*
          The collapsible section every screen uses, through one wrapper.

          Both places it appears — an event page and the organizer panel —
          need a token to reach, so this is where the variant can be looked at.
          Two of them, because `card` is a treatment you read as a stack: one
          rounded surface per section with a gap between them, and the open one
          lifting off the page.
        */}
        <Stack gap="3">
          <Text variant="h3">Disclosure</Text>
          <Disclosure id="smoke-links" label="Links del evento">
            <Text variant="small" color="muted">
              El de invitados y el de organizador, que se comparten por WhatsApp.
            </Text>
          </Disclosure>
          <Disclosure id="smoke-edit" label="Editar el evento" defaultOpen>
            <Text variant="small" color="muted">
              Abierto de entrada, para ver cómo se levanta la tarjeta cuando lo está.
            </Text>
          </Disclosure>
        </Stack>

        {/*
          The invitation editor, which `/messages` needs a session to reach.

          Here for the half that can be looked at without one: typing, the
          insert buttons and the live preview, which all run in the browser.
          Saving calls a server action that requires an account, so the button
          on this page reports "sign in" rather than doing anything — the point
          is the editing, not the storing.
        */}
        <Stack gap="3">
          <Text variant="h3">Invitation editor</Text>
          <MessageForm
            stored={null}
            fallback={copy.share.defaultMessage}
            sample={{
              title: "Fútbol de los jueves",
              when: "jue, 7 ago, 8:00 p. m. (Bogotá)",
              link: "https://junti-three.vercel.app/e/ejemplo",
            }}
          />
        </Stack>

        {/*
          The event cards, which `/my-events` needs a session to reach.

          Three fabricated events rather than one, because the card's whole
          job is to be scanned in a stack: the band colour is hashed from the
          event type, so two of a kind sharing a stripe and a past one dropping
          to grey are only visible next to each other. The actions are live —
          they act on ids that do not exist, which is the one thing not to
          press here.
        */}
        <Stack gap="3">
          <Text variant="h3">Event cards</Text>
          <EventList events={SMOKE_EVENTS} />
        </Stack>

        {/*
          The same language control `/profile` renders, outside a dialog.

          Worth its own entry because the two contexts stack differently: in the
          drawer the list has to clear a modal, here it has nothing to clear,
          and both come from one component. `/profile` needs a session, so this
          is where that half can be looked at.

          Local state rather than the real preference: this page is for looking
          at controls, not for changing the language of the browser you are
          looking at them in.
        */}
        <Stack gap="3">
          <Text variant="h3">Language combobox</Text>
          <Text variant="small" color="muted">
            As `/profile` renders it, with the &quot;follow my browser&quot; option the
            drawer&apos;s quick switch leaves out. Filters by typing; each language names itself.
          </Text>
          <LanguageCombobox
            value={smokeLocale}
            onValueChange={setSmokeLocale}
            options={[
              { value: "auto", label: copy.profile.languageAuto },
              ...LOCALES.map((option) => ({
                value: option,
                label: getCopy(option).localeName,
              })),
            ]}
            ariaLabel={copy.profile.languageLabel}
          />
        </Stack>
      </Stack>
    </Container>
  );
}
