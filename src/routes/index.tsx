import { Card, CardContent } from "@stackmyth/card";
import { Badge } from "@stackmyth/badge";
import { Container, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { createFileRoute } from "@tanstack/react-router";

import { Chapa } from "@/components/chapa";
import { es } from "@/config/copy/es";

/**
 * Phase-1 placeholder for the landing page.
 *
 * Exists to prove the skeleton end to end — SSR through Vite, the full
 * stylesheet chain, brand fonts from /public, and a handful of Stackmyth
 * components rendering with Junti's tokens (the sticker lean on the Badge is
 * the canary: it only happens if brand-marks.css survived the trip). The real
 * landing crosses in phase 4 with its route, copy provider and metadata.
 */
export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  return (
    <Container size="2" px="4" py="8">
      <Stack gap="5" align="center">
        <Chapa width={140} />

        <Text variant="h2" fontFamily="var(--junti-display)">
          {es.home.heading}
        </Text>
        <Text color="muted">{es.home.subheading}</Text>

        <Card surface="outlined">
          <CardContent>
            <Stack gap="3" align="start">
              <Badge variant="success" size="sm" soft className="junti-chapita">
                {es.money.paid}
              </Badge>
              <Text variant="small" color="muted">
                TanStack Start · fase 1 — si la chapita de arriba está verde y
                torcida, todo el CSS llegó en orden.
              </Text>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
