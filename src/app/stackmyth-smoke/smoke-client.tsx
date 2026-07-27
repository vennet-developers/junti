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

/**
 * Renders one of each primitive the app will actually use. If this page looks
 * right at 390px, the stack is usable; if a component is missing a prop or
 * blows up the layout, that is a gap and belongs in STACKMYTH-GAPS.md.
 */
export function SmokeClient() {
  const [name, setName] = useState("");
  const [answer, setAnswer] = useState("in");
  const [kind, setKind] = useState("match");

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
      </Stack>
    </Container>
  );
}
