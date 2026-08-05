import { Badge } from "@stackmyth/badge";
import { Card, CardContent } from "@stackmyth/card";
import { Box, Container, Divider, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { pageTitle } from "@/lib/page-title";

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
  const [{ getOrganizer }, { loadFunnel }] = await Promise.all([
    import("@/lib/organizer"),
    import("@/lib/funnel"),
  ]);

  const owner = process.env.ANALYTICS_OWNER_ID;
  const organizer = await getOrganizer();

  // Unset variable means nobody, not everybody. A missing secret must never
  // widen access.
  if (!owner || !organizer || organizer.id !== owner) throw notFound();

  return loadFunnel(30);
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
            Funnel
          </Text>
          <Text color="muted">
            Los últimos {report.days} días. Cada porcentaje es contra el primer paso, no contra el
            anterior: tres pasos seguidos al 80% suenan bien y significan que se fue la mitad.
          </Text>
        </Stack>

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

        {/* AC-7 of the send-limits card. Here rather than on a second admin
            page: there is one owner-gated screen in this product and a second
            one would be a second thing to remember exists. */}
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
    </Container>
  );
}
