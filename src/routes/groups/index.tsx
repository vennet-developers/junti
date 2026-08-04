import { Badge } from "@stackmyth/badge";
import { Card, CardContent } from "@stackmyth/card";
import { Box, Container, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { useCopy } from "@/components/copy-provider";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { MAX_GROUP_MEMBERS } from "@/domain/groups";
import { pageTitle } from "@/lib/page-title";
import { ROUTES, groupPath, signInPath } from "@/config/routes";

import { CreateGroupForm } from "./-group-forms";

/**
 * The organizer's groups.
 *
 * A group is the answer to a question this app used to force on people every
 * single time: "who am I allowed to write to?" It used to be answered by
 * pasting addresses, which answered it wrongly — an address is not consent.
 * Now it is answered once, by the people themselves, and reused for every
 * event after that.
 *
 * Signed-in only, and scoped by ownership. There is no token version of this
 * page, deliberately: a manage link delegates running an event, and nobody
 * should be able to hand somebody else their list of people.
 */
const getGroups = createServerFn({ method: "GET" }).handler(async () => {
  const [{ getOrganizer }, { resolvePreferences }, { loadOwnedGroups }] = await Promise.all([
    import("@/lib/organizer"),
    import("@/lib/preferences"),
    import("@/lib/groups"),
  ]);

  const organizer = await getOrganizer();
  if (!organizer) throw redirect({ to: signInPath(ROUTES.groups) as never });

  const { copy } = await resolvePreferences();
  const groups = await loadOwnedGroups(organizer.id);

  return {
    title: copy.groups.title,
    groups: groups.map((group) => ({
      id: group.id,
      name: group.name,
      memberCount: group.memberCount,
      path: groupPath(group.id),
    })),
  };
});

export const Route = createFileRoute("/groups/")({
  loader: () => getGroups(),
  head: ({ loaderData }) => ({
    meta: [
      { title: pageTitle(loaderData?.title) },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: GroupsPage,
});

function GroupsPage() {
  const { copy } = useCopy();
  const { groups } = Route.useLoaderData();

  return (
    <Container size="3" px="4" py="6">
      <Stack gap="6">
        <PageBreadcrumb
          label={copy.nav.breadcrumbLabel}
          items={[
            { label: copy.auth.myEventsLink, href: ROUTES.myEvents },
            { label: copy.groups.link },
          ]}
        />

        <Stack gap="2">
          <Text as="h1" variant="h3" fontFamily="var(--junti-display)">
            {copy.groups.heading}
          </Text>
          <Text color="muted">{copy.groups.subheading}</Text>
        </Stack>

        {groups.length === 0 ? (
          <Stack gap="2">
            <Text weight="medium">{copy.groups.emptyTitle}</Text>
            <Text variant="small" color="muted">
              {copy.groups.emptyHelp}
            </Text>
          </Stack>
        ) : (
          <Stack gap="3">
            {groups.map((group) => (
              <Card key={group.id} surface="outlined">
                <CardContent>
                  {/* The whole card is the link. A group has one thing to do
                      with it — open it — so a separate "manage" affordance
                      would just be a smaller target for the same click. */}
                  <Box as={Link} href={group.path}>
                    <Flex gap="3" align="center" justify="between" wrap="wrap">
                      <Text weight="semibold">{group.name}</Text>

                      <Flex gap="2" align="center">
                        {group.memberCount >= MAX_GROUP_MEMBERS ? (
                          <Badge variant="warning" size="sm" soft>
                            {copy.groups.fullBadge}
                          </Badge>
                        ) : null}
                        <Badge variant="outline" size="sm">
                          {group.memberCount === 0
                            ? copy.groups.memberCountEmpty
                            : copy.groups.memberCount(group.memberCount)}
                        </Badge>
                      </Flex>
                    </Flex>
                  </Box>
                </CardContent>
              </Card>
            ))}
          </Stack>
        )}

        <Card surface="outlined">
          <CardContent>
            <Stack gap="4">
              <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
                {copy.groups.createHeading}
              </Text>
              <CreateGroupForm />
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
