import { Badge } from "@stackmyth/badge";
import { Card, CardContent } from "@stackmyth/card";
import { Box, Container, Divider, Flex, Stack } from "@stackmyth/layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@stackmyth/tabs";
import { Text } from "@stackmyth/text";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { pageTitle } from "@/lib/page-title";
import { OverviewPanel } from "@/components/overview-panel";
import {
  CALENDAR_REPEAT_THRESHOLD,
  CALENDAR_SHARE_THRESHOLD,
  meetsGate,
} from "@/domain/calendar-gate";

/**
 * The funnel, as a page somebody can open.
 *
 * This is AC-4 of the analytics card: the two questions have to be answerable
 * "without engineering help", and with the events living in Postgres the only
 * honest reading of that is a screen with the numbers on it. Four fixed
 * queries, no filters, no date picker, no chart library — the point is to be
 * read, not configured.
 *
 * **Owner-only, and deliberately crude about it.** There is no admin role in
 * this product (see DECISIONS.md #56) and inventing one for a page of counts
 * would be the tail wagging the dog. The gate is the controller's own account
 * id, from an environment variable, and a 404 rather than a 403 for everybody
 * else — a page that says "forbidden" tells you it exists.
 *
 * Not in `ROUTES` on purpose: nothing links here, and it should stay that way.
 */
const getFunnel = createServerFn({ method: "POST" }).handler(async () => {
  const [{ getOrganizer }, { loadFunnel }, { loadOverview }] = await Promise.all([
    import("@/lib/organizer"),
    import("@/lib/funnel"),
    import("@/lib/overview"),
  ]);

  const owner = process.env.ANALYTICS_OWNER_ID;
  const organizer = await getOrganizer();

  // Unset variable means nobody, not everybody. A missing secret must never
  // widen access.
  if (!owner || !organizer || organizer.id !== owner) throw notFound();

  /*
    Sequential, not `Promise.all`. Both halves fan out internally, and running
    them together put roughly fourteen statements through a pool of five — see
    the note in `db/client.ts`, and the 500 that produced. This page is opened
    by one person and an extra second is invisible; a timeout is not.
  */
  const funnel = await loadFunnel(30);
  const overview = await loadOverview(30);
  return { ...funnel, overview };
});

export const Route = createFileRoute("/funnel")({
  loader: () => getFunnel(),
  head: () => ({
    meta: [{ title: pageTitle("Funnel") }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: FunnelPage,
});

/**
 * One step, with how many of the step above it survived to here.
 *
 * The percentage is against the FIRST step rather than the previous one. Step
 * to step reads better when every step is healthy and hides the shape when one
 * is not: three consecutive 80% steps sound fine and mean half the people are
 * gone.
 */
function Step({ name, count, first }: { name: string; count: number; first: number }) {
  const share = first === 0 ? 0 : Math.round((count / first) * 100);

  return (
    <Flex gap="3" align="center" justify="between">
      <Text variant="small" fontFamily="ui-monospace, SFMono-Regular, monospace">
        {name}
      </Text>
      <Flex gap="3" align="center">
        <Text weight="semibold">{count}</Text>
        <Box minWidth="3.5rem">
          <Badge variant={share >= 50 ? "success" : share >= 20 ? "warning" : "outline"} size="sm" soft>
            {share}%
          </Badge>
        </Box>
      </Flex>
    </Flex>
  );
}

function Funnel({ title, help, steps }: { title: string; help: string; steps: { name: string; count: number }[] }) {
  const first = steps[0]?.count ?? 0;

  return (
    <Card surface="outlined">
      <CardContent>
        <Stack gap="4">
          <Stack gap="1">
            <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
              {title}
            </Text>
            <Text variant="small" color="muted">
              {help}
            </Text>
          </Stack>

          <Stack gap="3">
            {steps.map((s) => (
              <Step key={s.name} name={s.name} count={s.count} first={first} />
            ))}
          </Stack>
        </Stack>
      </CardContent>
    </Card>
  );
}

/**
 * One half of the calendar gate, with the verdict already reached.
 *
 * The badge says *met* or *not met* rather than showing a number beside a
 * threshold somebody has to remember. That is the entire reason this is not
 * just another {@link Step}: a funnel step is a measurement, and this is a
 * decision waiting to be read six weeks after it was designed.
 *
 * "Sin datos" is its own state and deliberately not a failure. A null
 * percentage means the denominator is empty — nobody has visited — which is a
 * different statement from "people saw it and did not want it", and letting a
 * quiet fortnight close the gate would be the wrong call made silently.
 */
function GateRow({
  label,
  detail,
  percent,
  threshold,
}: {
  label: string;
  detail: string;
  percent: number | null;
  threshold: number;
}) {
  const met = meetsGate(percent, threshold);

  return (
    <Flex gap="3" align="start" justify="between" wrap="wrap">
      <Stack gap="0" minWidth="0">
        <Text variant="small" weight="medium">
          {label}
        </Text>
        <Text variant="small" color="muted">
          {detail}
        </Text>
      </Stack>

      <Flex gap="3" align="center">
        <Text weight="semibold">{percent === null ? "—" : `${percent}%`}</Text>
        <Box minWidth="6.5rem">
          <Badge
            variant={met === null ? "outline" : met ? "success" : "warning"}
            size="sm"
            soft
          >
            {met === null ? "Sin datos" : met ? `≥ ${threshold}%` : `< ${threshold}%`}
          </Badge>
        </Box>
      </Flex>
    </Flex>
  );
}

function FunnelPage() {
  const report = Route.useLoaderData();

  // The hourly limit is what "unusual" is measured against, so the badge turns
  // colour relative to the live setting rather than a number baked in here.
  const peakLimit = report.limits.find((l) => l.name === "invitesPerHour")?.value ?? 100;

  return (
    <Container size="3" px="4" py="6">
      <Stack gap="6">
        <Stack gap="2">
          <Text as="h1" variant="h3" fontFamily="var(--junti-display)">
            Panel
          </Text>
          <Text color="muted">
            Cuánto hay, hacia dónde va, y dónde se cae la gente. Sólo lo ve la cuenta
            en <code>ANALYTICS_OWNER_ID</code>; para todos los demás esta ruta no existe.
          </Text>
        </Stack>

        {/*
          Tres pestañas, una pregunta cada una: cuánto hay y si se mueve
          (Resumen), dónde se cae la gente (Embudos), y qué está pasando
          ahora mismo (Operación). Una versión anterior las descartó mientras
          se perseguía un cuelgue del SSR que resultó ser de la librería de
          gráficas, no de Tabs; con las barras en SVG propio no queda nada que
          pueda colgarse, y tres preguntas apiladas eran una página de scroll
          sin jerarquía.

          «Resumen» por defecto: es lo que se abre cuando no se viene buscando
          nada en particular.
        */}
        <Tabs defaultValue="resumen" size="xl">
          <TabsList fullWidth>
            <TabsTrigger value="resumen">Resumen</TabsTrigger>
            <TabsTrigger value="embudos">Embudos</TabsTrigger>
            <TabsTrigger value="operacion">Operación</TabsTrigger>
          </TabsList>

          <TabsContent value="resumen">
            <OverviewPanel overview={report.overview} />
          </TabsContent>

          <TabsContent value="embudos">
        <Stack gap="5" pt="4">
          <Text variant="small" color="muted">
            Los últimos {report.days} días. Cada porcentaje es contra el primer paso, no contra el
            anterior: tres pasos seguidos al 80% suenan bien y significan que se fue la mitad.
          </Text>

        <Funnel
          title="Participantes"
          help="Dónde se cae la gente entre abrir el link y quedar contada."
          steps={report.participant}
        />

        <Funnel
          title="Organizadores"
          help="Dónde se abandona entre abrir el formulario y tener un evento."
          steps={report.organizer}
        />

        <Funnel
          title="Grupos"
          help="Si el link se vuelve membresía, y cuántos dicen que no."
          steps={report.groups}
        />

        {/*
          The Google Calendar gate, read rather than computed by whoever opens
          this. The card refuses to start until these two numbers clear their
          thresholds, and the thresholds were written down before any data
          existed precisely so they could not be adjusted afterwards to justify
          a decision already made.
        */}
        <Card surface="outlined">
          <CardContent>
            <Stack gap="4">
              <Stack gap="1">
                <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
                  ¿Alguien quiere calendario?
                </Text>
                <Text variant="small" color="muted">
                  La compuerta de la tarjeta de Google Calendar. Se lee sobre un
                  ciclo completo de un evento recurrente — seis a ocho semanas.
                  Una semana es una lectura de novedad, no de hábito.
                </Text>
              </Stack>

              <Stack gap="3">
                <GateRow
                  label="Descargan el .ics"
                  detail={`${report.calendar.downloads} de ${report.calendar.viewers} que abrieron un evento`}
                  percent={report.calendar.sharePercent}
                  threshold={CALENDAR_SHARE_THRESHOLD}
                />
                <GateRow
                  label="Repiten"
                  detail={
                    report.calendar.knownDownloaders === 0
                      ? "Nadie con sesión ha descargado todavía"
                      : `${report.calendar.repeatDownloaders} de ${report.calendar.knownDownloaders} con sesión, más de una vez`
                  }
                  percent={report.calendar.repeatPercent}
                  threshold={CALENDAR_REPEAT_THRESHOLD}
                />
              </Stack>

              {report.calendar.cancellations > 0 ? (
                <Text variant="small" color="muted">
                  {report.calendar.cancellations} descarga
                  {report.calendar.cancellations === 1 ? "" : "s"} fue
                  {report.calendar.cancellations === 1 ? "" : "ron"} de un evento
                  cancelado. No cuentan como demanda — sacar algo muerto del
                  calendario es lo contrario de querer sincronizarlo.
                </Text>
              ) : null}

              <Text variant="small" color="muted">
                El porcentaje de repetición sólo ve a quien tenía sesión al
                descargar. La ruta no exige cuenta, así que a un lector anónimo
                no hay forma de contarlo dos veces.
              </Text>
            </Stack>
          </CardContent>
        </Card>

        </Stack>
          </TabsContent>

          <TabsContent value="operacion">
        <Stack gap="5" pt="4">
        {/* AC-7 of the send-limits card. */}
        <Card surface="outlined">
          <CardContent>
            <Stack gap="4">
              <Stack gap="1">
                <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
                  Envíos por organizador
                </Text>
                <Text variant="small" color="muted">
                  Últimas 24 horas. El pico de una hora es la señal: cien envíos
                  repartidos en un día es alguien ocupado; cien en una hora es
                  alguien probando hasta dónde llega esto.
                </Text>
              </Stack>

              {report.sends.length === 0 ? (
                <Text variant="small" color="muted">
                  Nadie ha enviado nada en el último día.
                </Text>
              ) : (
                <Stack gap="2">
                  {report.sends.map((row) => (
                    <Flex key={row.key} gap="3" align="center" justify="between">
                      <Text variant="small" fontFamily="ui-monospace, SFMono-Regular, monospace">
                        {row.key}
                      </Text>
                      <Flex gap="3" align="center">
                        <Text variant="small" color="muted">
                          {row.day} en el día
                        </Text>
                        <Badge
                          variant={row.peakHour >= peakLimit ? "error" : row.peakHour >= peakLimit / 2 ? "warning" : "outline"}
                          size="sm"
                          soft
                        >
                          pico {row.peakHour}
                        </Badge>
                      </Flex>
                    </Flex>
                  ))}
                </Stack>
              )}

              <Divider />

              <Stack gap="1">
                <Text variant="small" weight="semibold">
                  Límites vigentes
                </Text>
                <Text variant="small" color="muted">
                  Se cambian con una fila en <code>app_settings</code>, sin desplegar. Borrar la
                  fila vuelve al valor por defecto.
                </Text>
              </Stack>

              <Stack gap="2">
                {report.limits.map((limit) => (
                  <Flex key={limit.name} gap="3" align="center" justify="between">
                    <Text variant="small" fontFamily="ui-monospace, SFMono-Regular, monospace">
                      {limit.name}
                    </Text>
                    <Flex gap="2" align="center">
                      <Text weight="semibold">{limit.value}</Text>
                      <Badge variant={limit.isDefault ? "outline" : "warning"} size="sm" soft>
                        {limit.isDefault ? "por defecto" : "ajustado"}
                      </Badge>
                    </Flex>
                  </Flex>
                ))}
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        {/* The half of the email card that was never about volume: `notify()`
            swallows failures on purpose, so before the outbox a send that did
            not happen was invisible everywhere. This is where it is visible. */}
        <Card surface="outlined">
          <CardContent>
            <Stack gap="4">
              <Stack gap="1">
                <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
                  Correos
                </Text>
                <Text variant="small" color="muted">
                  Pendiente es normal por un momento: cada mensaje se intenta al
                  escribirlo y el barrido corre cada seis horas. Fallido es que
                  se agotaron los cinco intentos.
                </Text>
              </Stack>

              <Flex gap="4" align="center">
                <Flex gap="2" align="center">
                  <Text weight="semibold">{report.outbox.pending}</Text>
                  <Text variant="small" color="muted">
                    pendientes
                  </Text>
                </Flex>
                <Flex gap="2" align="center">
                  <Text weight="semibold">{report.outbox.failed}</Text>
                  <Badge variant={report.outbox.failed > 0 ? "error" : "outline"} size="sm" soft>
                    fallidos
                  </Badge>
                </Flex>
              </Flex>

              {report.outbox.recentErrors.length > 0 ? (
                <Stack gap="2">
                  <Divider />
                  {report.outbox.recentErrors.map((row, index) => (
                    <Stack key={index} gap="1">
                      <Flex gap="2" align="center" justify="between">
                        <Text variant="small" fontFamily="ui-monospace, SFMono-Regular, monospace">
                          {row.template}
                        </Text>
                        <Text variant="small" color="muted">
                          {row.attempts} intentos
                        </Text>
                      </Flex>
                      <Text variant="small" color="error">
                        {row.error}
                      </Text>
                    </Stack>
                  ))}
                </Stack>
              ) : null}
            </Stack>
          </CardContent>
        </Card>

        <Card surface="outlined">
          <CardContent>
            <Stack gap="3">
              <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
                Últimos 50 eventos
              </Text>
              <Divider />
              <Stack gap="2">
                {report.recent.length === 0 ? (
                  <Text variant="small" color="muted">
                    Nada todavía. Los eventos empiezan a llegar con el primer uso.
                  </Text>
                ) : (
                  report.recent.map((row, index) => (
                    <Flex key={index} gap="3" align="center" justify="between">
                      <Text variant="small" fontFamily="ui-monospace, SFMono-Regular, monospace">
                        {row.name}
                      </Text>
                      <Flex gap="2" align="center">
                        <Badge variant="outline" size="sm">
                          {row.source}
                        </Badge>
                        <Text variant="small" color="muted">
                          {new Date(row.at).toISOString().slice(0, 16).replace("T", " ")}
                        </Text>
                      </Flex>
                    </Flex>
                  ))
                )}
              </Stack>
            </Stack>
          </CardContent>
        </Card>
        </Stack>
          </TabsContent>
        </Tabs>
      </Stack>
    </Container>
  );
}
