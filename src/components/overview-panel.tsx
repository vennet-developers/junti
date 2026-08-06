import type { ReactNode } from "react";

import { Card, CardContent } from "@stackmyth/card";
import {
  CalendarIcon,
  MailIcon,
  ShoppingCartIcon,
  UserIcon,
  UserPlusIcon,
  ZapIcon,
} from "@stackmyth/icons";
import { Box, Divider, Flex, Grid, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";

import { AreaChart } from "@/components/area-chart";
import { Donut } from "@/components/donut";
import { MiniBars } from "@/components/mini-bars";
import { SegmentBar } from "@/components/segment-bar";
import { Sparkline } from "@/components/sparkline";
import { formatMoney } from "@/lib/format";
import type { Metric, OverviewReport } from "@/lib/overview";

/**
 * The Resumen tab: the state of the system, drawn to be read at a glance.
 *
 * The layout follows one rule — **the number first, the picture beside it**.
 * Every card leads with an icon chip in the brand's soft orange and a large
 * figure; sparklines and rings sit next to their number, never instead of it,
 * because a chart without its figure makes the reader estimate what the
 * database knows exactly.
 */

/** The brand-orange chip every card leads with. */
function IconChip({ children }: { children: ReactNode }) {
  return (
    <Flex
      align="center"
      justify="center"
      width="2.25rem"
      height="2.25rem"
      borderRadius="0.625rem"
      backgroundColor="var(--junti-naranja-suave)"
      color="var(--junti-naranja-suave-texto)"
      flexShrink={0}
    >
      {children}
    </Flex>
  );
}

/**
 * One headline: chip, total, and how the period moved.
 *
 * The delta renders only when there was a previous period to compare — "0%"
 * against silence is a verdict nobody measured, and `Metric.change` is null
 * precisely there.
 */
function HeadlineCard({
  icon,
  label,
  metric,
}: {
  icon: ReactNode;
  label: string;
  metric: Metric;
}) {
  return (
    <Card surface="outlined">
      <CardContent>
        <Stack gap="3">
          <IconChip>{icon}</IconChip>
          <Stack gap="1">
            <Text as="span" variant="h3" weight="semibold" fontFamily="var(--junti-display)">
              {metric.total.toLocaleString("es-CO")}
            </Text>
            <Text variant="small" color="muted">
              {label}
            </Text>
          </Stack>
          <Flex gap="2" align="baseline" wrap="wrap">
            <Text variant="small" weight="medium">
              +{metric.window.toLocaleString("es-CO")} en el periodo
            </Text>
            {/* `Text` has no "success" color (STACKMYTH-GAPS #25 territory);
                a Box carries the token and Text inherits. */}
            {metric.change !== null ? (
              <Box
                as="span"
                color={
                  metric.change >= 0
                    ? "var(--junti-viene-fg, #15803d)"
                    : "var(--junti-error-fg, #b91c1c)"
                }
              >
                <Text as="span" variant="small" color="inherit">
                  {metric.change >= 0 ? "▲" : "▼"} {Math.abs(metric.change)}%
                </Text>
              </Box>
            ) : null}
          </Flex>
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Chip + label + big number + trend beside it — the Attio-style trend card. */
function TrendCard({
  icon,
  label,
  value,
  caption,
  values,
  ariaLabel,
  variant = "sparkline",
}: {
  icon: ReactNode;
  label: string;
  value: string;
  caption: string;
  values: readonly number[];
  ariaLabel: string;
  /* MiniBars when the buckets themselves matter (empty days as dots);
     sparkline when only the direction does. */
  variant?: "sparkline" | "minibars";
}) {
  const flat = values.every((v) => v === 0);

  return (
    <Card surface="outlined">
      <CardContent>
        <Stack gap="3">
          <IconChip>{icon}</IconChip>
          <Flex gap="4" align="end" justify="between" wrap="wrap">
            <Stack gap="1" minWidth="0">
              <Text variant="small" color="muted">
                {label}
              </Text>
              <Text as="span" variant="h4" weight="semibold" fontFamily="var(--junti-display)">
                {value}
              </Text>
              <Text variant="small" color="muted">
                {caption}
              </Text>
            </Stack>
            {/* A flat sparkline of zeros draws a floor-line that reads as
                data. Nothing is the honest picture of nothing. */}
            {flat ? null : (
              <Box width="7.5rem" height="2.25rem" flexShrink={0}>
                {variant === "minibars" ? (
                  <MiniBars values={values} ariaLabel={ariaLabel} />
                ) : (
                  <Sparkline values={values} ariaLabel={ariaLabel} />
                )}
              </Box>
            )}
          </Flex>
        </Stack>
      </CardContent>
    </Card>
  );
}

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

const pct = (value: number | null) => (value === null ? "Sin datos" : `${value}%`);
const cop = (minor: number) => formatMoney(minor, "COP", "es-CO");

export function OverviewPanel({ overview }: { overview: OverviewReport }) {
  const { depth, money, emails, projection } = overview;
  const paidShare = depth.paidEventPercent;

  return (
    <Stack gap="5" pt="4">
      {/* ── Los cuatro conteos ─────────────────────────────────────────── */}
      <Grid columns={{ base: "1", sm: "2", lg: "4" }} gap="3">
        <HeadlineCard
          icon={<UserIcon size={18} aria-hidden="true" />}
          label="Usuarios registrados"
          metric={overview.accounts}
        />
        <HeadlineCard
          icon={<CalendarIcon size={18} aria-hidden="true" />}
          label="Eventos creados"
          metric={overview.events}
        />
        <HeadlineCard
          icon={<UserPlusIcon size={18} aria-hidden="true" />}
          label="Grupos"
          metric={overview.groups}
        />
        <HeadlineCard
          icon={<MailIcon size={18} aria-hidden="true" />}
          label="Correos enviados"
          metric={emails.sent}
        />
      </Grid>

      {/* ── La plata y el pulso ────────────────────────────────────────── */}
      <Grid columns={{ base: "1", lg: "3" }} gap="3">
        {/*
          The number monetization waits on: how much money the product
          coordinates without touching. A platform coordinating serious money
          has something to charge a fee against; one coordinating pizza
          budgets does not, and this card is where that becomes visible.
        */}
        <Card surface="outlined">
          <CardContent>
            <Stack gap="3">
              <IconChip>
                <ShoppingCartIcon size={18} aria-hidden="true" />
              </IconChip>
              <Stack gap="1">
                <Text variant="small" color="muted">
                  Plata coordinada
                </Text>
                <Text as="span" variant="h4" weight="semibold" fontFamily="var(--junti-display)">
                  {cop(money.trackedMinor)}
                </Text>
                <Text variant="small" color="muted">
                  {cop(money.confirmedMinor)} confirmada · {cop(money.windowConfirmedMinor)} en el
                  periodo
                </Text>
              </Stack>
            </Stack>
          </CardContent>
        </Card>

        <TrendCard
          icon={<ZapIcon size={18} aria-hidden="true" />}
          label="Actividad"
          value={overview.rsvps.window.toLocaleString("es-CO")}
          caption={`respuestas en ${overview.days} días`}
          values={overview.weeklyRsvps.map((week) => week.value)}
          ariaLabel="Tendencia semanal de respuestas"
          variant="minibars"
        />

        {/*
          The paid-events ring: the share of events that charge money, which
          is what says whether the payment features earn their upkeep — and
          what a take-rate would ever apply to.
        */}
        <Card surface="outlined">
          <CardContent>
            <Flex gap="4" align="center">
              <Donut
                share={(paidShare ?? 0) / 100}
                ariaLabel={`${paidShare ?? 0}% de los eventos tienen costo`}
              >
                {pct(paidShare)}
              </Donut>
              <Stack gap="1" minWidth="0">
                <Text variant="small" weight="semibold">
                  Eventos con costo
                </Text>
                <Text variant="small" color="muted">
                  Base de cualquier comisión futura.
                </Text>
              </Stack>
            </Flex>
          </CardContent>
        </Card>
      </Grid>

      {/* ── Cómo se mueve: cuatro tendencias, curvas suaves ────────────── */}
      <Grid columns={{ base: "1", md: "2" }} gap="3">
        {(
          [
            ["Cuentas nuevas", overview.weeklyAccounts, overview.accounts.window],
            ["Eventos creados", overview.weeklyEvents, overview.events.window],
            ["Respuestas", overview.weeklyRsvps, overview.rsvps.window],
            ["Correos enviados", emails.weekly, emails.sent.window],
          ] as const
        ).map(([title, points, windowTotal]) => (
          <Card key={title} surface="outlined">
            <CardContent>
              <Stack gap="2">
                <Flex gap="3" align="baseline" justify="between">
                  <Text variant="small" color="muted">
                    {title}
                  </Text>
                  <Text as="span" weight="semibold">
                    {windowTotal.toLocaleString("es-CO")}
                  </Text>
                </Flex>
                {points.every((p) => p.value === 0) ? (
                  <Text variant="small" color="muted">
                    Sin datos todavía.
                  </Text>
                ) : (
                  <AreaChart points={points} ariaLabel={`${title} por semana`} />
                )}
              </Stack>
            </CardContent>
          </Card>
        ))}
      </Grid>

      {/* ── Respuestas por tipo: el pastel honesto, en los colores que el
             roster ya usa — «van» TIENE un color en este producto. ────────── */}
      {overview.attendance.going +
        overview.attendance.maybe +
        overview.attendance.notGoing +
        overview.attendance.waitlisted >
      0 ? (
        <Card surface="outlined">
          <CardContent>
            <Stack gap="3">
              <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
                Respuestas por tipo
              </Text>
              <SegmentBar
                ariaLabel="Respuestas por tipo"
                parts={[
                  { label: "Van", value: overview.attendance.going, token: "var(--junti-viene-fill, var(--junti-viene-fg))" },
                  { label: "Tal vez", value: overview.attendance.maybe, token: "var(--junti-talvez-fill, var(--junti-talvez-fg))" },
                  { label: "No van", value: overview.attendance.notGoing, token: "var(--junti-noviene-fill, var(--junti-noviene-fg))" },
                  { label: "En espera", value: overview.attendance.waitlisted, token: "var(--junti-espera-fill, var(--junti-espera-fg))" },
                ]}
              />
            </Stack>
          </CardContent>
        </Card>
      ) : null}

      {/* ── Proyección ─────────────────────────────────────────────────── */}
      <Card surface="outlined">
        <CardContent>
          <Stack gap="4">
            <Stack gap="1">
              <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
                Al ritmo actual, en 30 días
              </Text>
              <Text variant="small" color="muted">
                Últimas 4 semanas completas, extrapoladas. «—» hasta tener dos
                semanas con movimiento.
              </Text>
            </Stack>

            <Grid columns={{ base: "1", sm: "3" }} gap="3">
              {(
                [
                  ["Usuarios nuevos", projection.accountsNext30],
                  ["Eventos", projection.eventsNext30],
                  ["Respuestas", projection.rsvpsNext30],
                ] as const
              ).map(([label, value]) => (
                <Stack key={label} gap="1">
                  <Text as="span" variant="h4" weight="semibold" fontFamily="var(--junti-display)">
                    {value === null ? "—" : `≈ ${value.toLocaleString("es-CO")}`}
                  </Text>
                  <Text variant="small" color="muted">
                    {label}
                  </Text>
                </Stack>
              ))}
            </Grid>
          </Stack>
        </CardContent>
      </Card>

      {/* ── Si esto sirve o no ─────────────────────────────────────────── */}
      <Card surface="outlined">
        <CardContent>
          <Stack gap="4">
            <Stack gap="1">
              <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
                Si esto sirve o no
              </Text>
              <Text variant="small" color="muted">
                Toda la vida, no el periodo.
              </Text>
            </Stack>

            <Divider />

            <Stack gap="4">
              <DepthRow
                label="Organizadores que repiten"
                help="Crearon un segundo evento — el número que decide todo."
                value={pct(depth.repeatOrganizerPercent)}
                detail={`${depth.repeatOrganizers} de ${depth.organizers}`}
              />
              <DepthRow
                label="Participantes que vuelven"
                help="Se apuntaron a un segundo evento distinto."
                value={pct(depth.repeatParticipantPercent)}
                detail={`${depth.repeatParticipants} de ${depth.participants}`}
              />
              <DepthRow
                label="Tamaño típico"
                help="Confirmados por evento, promedio."
                value={
                  depth.averageAttendance === null
                    ? "Sin datos"
                    : `${depth.averageAttendance} personas`
                }
              />
              <DepthRow
                label="Del evento a la primera respuesta"
                help="Mediana de creación → primer «voy»."
                value={
                  depth.medianHoursToFirstRsvp === null
                    ? "Sin datos"
                    : depth.medianHoursToFirstRsvp < 1
                      ? "Menos de una hora"
                      : `${depth.medianHoursToFirstRsvp} h`
                }
              />
              <DepthRow
                label="Correos que no llegaron"
                help="Fallidos + suprimidos. El costo marginal real."
                value={String(emails.failed + emails.suppressed)}
                detail={
                  emails.failed + emails.suppressed > 0
                    ? `${emails.failed} fallidos · ${emails.suppressed} suprimidos`
                    : undefined
                }
              />
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </Stack>
  );
}
