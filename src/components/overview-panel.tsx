import { Card, CardContent } from "@stackmyth/card";
import { Divider, Flex, Grid, Stack } from "@stackmyth/layout";
import { Stat } from "@stackmyth/stat";
import { Text } from "@stackmyth/text";

import { GrowthChart } from "@/components/growth-chart";
import type { Metric, OverviewReport } from "@/lib/overview";


/**
 * One headline number, with how it moved.
 *
 * The total is the headline and the window is the delta's subject, which is
 * the pairing that answers "how big" and "is it growing" in one glance. A
 * dashboard that shows only the window makes a healthy product look like it
 * started yesterday; one that shows only the total never changes.
 */
function Headline({ label, metric }: { label: string; metric: Metric }) {
  return (
    <Card surface="outlined">
      <CardContent>
        <Stat
          label={label}
          value={metric.total.toLocaleString("es-CO")}
          /*
            Absent rather than zero when there is nothing to compare against —
            a first period, or a previous one that was empty. `delta` returns
            null for exactly that case, and rendering "0%" there would claim a
            flatness nobody measured.
          */
          delta={
            metric.change === null
              ? undefined
              : { value: metric.change, format: "raw", label: "vs. periodo anterior" }
          }
        />
        <Text variant="small" color="muted">
          {metric.window.toLocaleString("es-CO")} en el periodo
        </Text>
      </CardContent>
    </Card>
  );
}

/**
 * One number from the depth block, with the fraction it came from.
 *
 * The denominator is always visible. "50% de organizadores repiten" is a very
 * different statement when it is one out of two than when it is four hundred
 * out of eight hundred, and a percentage on its own cannot tell them apart —
 * which is the failure mode of every dashboard read six weeks after it was
 * built.
 */
function DepthRow({
  label,
  help,
  value,
  detail,
}: {
  label: string;
  help: string;
  value: string;
  detail?: string;
}) {
  return (
    <Flex gap="3" align="start" justify="between" wrap="wrap">
      <Stack gap="1" minWidth="0">
        <Text variant="small" weight="semibold">
          {label}
        </Text>
        <Text variant="small" color="muted">
          {help}
        </Text>
      </Stack>
      <Stack gap="1" align="end" flexShrink={0}>
        <Text weight="semibold">{value}</Text>
        {detail ? (
          <Text variant="small" color="muted">
            {detail}
          </Text>
        ) : null}
      </Stack>
    </Flex>
  );
}

/** "Sin datos" rather than a number nobody measured. */
const pct = (value: number | null) => (value === null ? "Sin datos" : `${value}%`);

export function OverviewPanel({ overview }: { overview: OverviewReport }) {
  const { depth } = overview;

  return (
    <Stack gap="5" pt="4">
      {/*
        No hay selector de ventana, y no es un olvido.

        Se construyó — 30 / 90 / un año, como enlaces con `?days=` — y el
        servidor renderiza las tres perfectamente. Lo que no sobrevive es la
        navegación del cliente: pulsar el enlace congela el render, y una
        pantalla que a veces deja de responder es peor que una sin la opción.
        La ventana queda fija en treinta días, igual que los embudos de abajo,
        que es la comparación honesta de todos modos.
      */}
      <Grid columns={{ base: "1", sm: "2", lg: "4" }} gap="3">
        <Headline label="Cuentas" metric={overview.accounts} />
        <Headline label="Eventos" metric={overview.events} />
        <Headline label="Respuestas" metric={overview.rsvps} />
        <Headline label="Grupos" metric={overview.groups} />
      </Grid>

      <Card surface="outlined">
        <CardContent>
          <Stack gap="5">
            <Stack gap="1">
              <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
                Cómo se mueve
              </Text>
              <Text variant="small" color="muted">
                Por semana. Una semana sin nada es una barra en cero, no un hueco — si
                desapareciera, el eje del tiempo mentiría.
              </Text>
            </Stack>

            <GrowthChart
              title="Cuentas nuevas"
              points={overview.weeklyAccounts}
              ariaLabel="Cuentas nuevas por semana"
            />
            <GrowthChart
              title="Eventos creados"
              points={overview.weeklyEvents}
              ariaLabel="Eventos creados por semana"
            />
            <GrowthChart
              title="Respuestas"
              points={overview.weeklyRsvps}
              ariaLabel="Respuestas de participantes por semana"
            />
          </Stack>
        </CardContent>
      </Card>

      {/*
        The block worth opening this page for. Everything above only ever goes
        up; these are the numbers that can say the product is not working.
      */}
      <Card surface="outlined">
        <CardContent>
          <Stack gap="4">
            <Stack gap="1">
              <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
                Si esto sirve o no
              </Text>
              <Text variant="small" color="muted">
                De toda la vida, no del periodo: «¿volvió?» es una pregunta sobre una
                trayectoria, y recortarla a treinta días contaría un segundo evento como
                si fuera el primero.
              </Text>
            </Stack>

            <Divider />

            <Stack gap="4">
              <DepthRow
                label="Organizadores que repiten"
                help="Crearon más de un evento. Es el número más importante de la página: si la gente organiza una vez y no vuelve, no importa cuántos registros haya."
                value={pct(depth.repeatOrganizerPercent)}
                detail={`${depth.repeatOrganizers} de ${depth.organizers}`}
              />
              <DepthRow
                label="Participantes que vuelven"
                help="Se apuntaron a más de un evento distinto. Cambiar de respuesta tres veces en el mismo evento no cuenta."
                value={pct(depth.repeatParticipantPercent)}
                detail={`${depth.repeatParticipants} de ${depth.participants}`}
              />
              <DepthRow
                label="Tamaño típico"
                help="Cuánta gente confirma por evento, en promedio."
                value={
                  depth.averageAttendance === null
                    ? "Sin datos"
                    : `${depth.averageAttendance} personas`
                }
              />
              <DepthRow
                label="Eventos con costo"
                help="Qué tanto importan las funciones de plata."
                value={pct(depth.paidEventPercent)}
              />
              <DepthRow
                label="Del evento a la primera respuesta"
                help="La mediana, no el promedio: un evento creado en enero para diciembre arrastra la media a la inutilidad."
                value={
                  depth.medianHoursToFirstRsvp === null
                    ? "Sin datos"
                    : depth.medianHoursToFirstRsvp < 1
                      ? "Menos de una hora"
                      : `${depth.medianHoursToFirstRsvp} h`
                }
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
