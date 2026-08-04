import { Badge } from "@stackmyth/badge";
import { Card, CardContent } from "@stackmyth/card";
import { Container, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { createFileRoute, notFound, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { PersonAvatar } from "@/components/person-avatar";
import { useCopy } from "@/components/copy-provider";
import { LinkPanel } from "@/components/link-panel";
import { PageBreadcrumb } from "@/components/page-breadcrumb";
import { MAX_GROUP_MEMBERS } from "@/domain/groups";
import { pageTitle } from "@/lib/page-title";
import { ROUTES, groupJoinPath, signInPath } from "@/config/routes";

import { DeleteGroupControl } from "./-group-forms";

/**
 * One group: who is in it, the link that put them there, and how to delete it.
 *
 * The member list shows names and photos and no addresses at all. That is not
 * an oversight to fix later — an owner needs to recognise the people in their
 * group, which a name does, and every address on a screen is an address that
 * can be copied off it.
 *
 * People who declined are listed too, greyed rather than hidden. "I asked Ana
 * and she said no" and "I never sent Ana the link" look identical when the no
 * is invisible, and only one of the two is worth doing something about.
 */
const getGroup = createServerFn({ method: "GET" })
  .validator((data: { groupId: string }) => data)
  .handler(async ({ data }) => {
    const [{ getOrganizer }, { resolvePreferences }, { loadGroupDetail }, { origin }] =
      await Promise.all([
        import("@/lib/organizer"),
        import("@/lib/preferences"),
        import("@/lib/groups"),
        import("@/lib/urls"),
      ]);

    const organizer = await getOrganizer();
    if (!organizer) throw redirect({ to: signInPath(ROUTES.groups) as never });

    const { copy } = await resolvePreferences();

    // Ownership is part of the query, so somebody else's group id is simply
    // not found rather than found-and-refused: there is nothing to learn from
    // the difference and no reason to confirm that an id exists.
    const group = await loadGroupDetail(data.groupId, organizer.id);
    if (!group) throw notFound();

    return {
      title: copy.groups.title,
      group: {
        id: group.id,
        name: group.name,
        memberCount: group.memberCount,
        joinUrl: `${await origin()}${groupJoinPath(group.joinToken)}`,
        members: group.members,
      },
    };
  });

export const Route = createFileRoute("/groups/$group_id")({
  loader: ({ params }) => getGroup({ data: { groupId: params.group_id } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: pageTitle(loaderData?.group.name ?? loaderData?.title) },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: GroupPage,
});

function GroupPage() {
  const { copy } = useCopy();
  const { group } = Route.useLoaderData();

  return (
    <Container size="3" px="4" py="6">
      <Stack gap="6">
        <PageBreadcrumb
          label={copy.nav.breadcrumbLabel}
          items={[
            { label: copy.auth.myEventsLink, href: ROUTES.myEvents },
            { label: copy.groups.link, href: ROUTES.groups },
            { label: group.name },
          ]}
        />

        <Stack gap="2">
          <Flex gap="3" align="center" wrap="wrap">
            <Text as="h1" variant="h3" fontFamily="var(--junti-display)">
              {group.name}
            </Text>
            <Badge variant="outline" size="sm">
              {copy.groups.capacity(group.memberCount, MAX_GROUP_MEMBERS)}
            </Badge>
          </Flex>
        </Stack>

        <Card surface="outlined">
          <CardContent>
            <Stack gap="4">
              <Stack gap="1">
                <Text as="h2" variant="h5" fontFamily="var(--junti-display)">
                  {copy.groups.membersHeading}
                </Text>
                <Text variant="small" color="muted">
                  {copy.groups.membersHelp}
                </Text>
              </Stack>

              {group.members.length === 0 ? (
                <Stack gap="1">
                  <Text weight="medium">{copy.groups.membersEmptyTitle}</Text>
                  <Text variant="small" color="muted">
                    {copy.groups.membersEmptyHelp}
                  </Text>
                </Stack>
              ) : (
                <Stack gap="3">
                  {group.members.map((member) => (
                    <Flex key={member.userId} gap="3" align="center" justify="between">
                      <Flex gap="3" align="center">
                        <PersonAvatar name={member.displayName} src={member.avatarUrl} />
                        <Text
                          variant="small"
                          color={member.status === "joined" ? "default" : "muted"}
                        >
                          {member.displayName}
                        </Text>
                      </Flex>

                      <Badge
                        variant={member.status === "joined" ? "success" : "outline"}
                        size="sm"
                        soft={member.status === "joined"}
                      >
                        {member.status === "joined"
                          ? copy.groups.statusJoined
                          : copy.groups.statusDeclined}
                      </Badge>
                    </Flex>
                  ))}
                </Stack>
              )}
            </Stack>
          </CardContent>
        </Card>

        <Card surface="outlined">
          <CardContent>
            <LinkPanel
              label={copy.groups.shareHeading}
              help={copy.groups.shareHelp}
              url={group.joinUrl}
              copyLabel={copy.groups.copyLink}
            />
          </CardContent>
        </Card>

        <Card surface="outlined">
          <CardContent>
            <Stack gap="3">
              <Stack gap="1">
                <Text weight="semibold">{copy.groups.deleteHeading}</Text>
                <Text variant="small" color="muted">
                  {copy.groups.deleteHelp}
                </Text>
              </Stack>
              <Flex>
                <DeleteGroupControl groupId={group.id} name={group.name} />
              </Flex>
            </Stack>
          </CardContent>
        </Card>
      </Stack>
    </Container>
  );
}
