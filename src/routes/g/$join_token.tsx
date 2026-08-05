import { Card, CardContent } from "@stackmyth/card";
import { Button } from "@stackmyth/button";
import { Container, Flex, Stack } from "@stackmyth/layout";
import { Text } from "@stackmyth/text";
import { Link, createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

import { useCopy } from "@/components/copy-provider";
import { TrackView } from "@/components/track-view";
import { MAX_GROUP_MEMBERS } from "@/domain/groups";
import type { GroupJoinState } from "@/domain/groups";
import { pageTitle } from "@/lib/page-title";
import { groupJoinPath, signInPath } from "@/config/routes";

import { AnswerGroupControls, LeaveGroupControl } from "../groups/-group-forms";

/**
 * The page a group link lands on. **This is where consent happens.**
 *
 * Everything else in the feature is bookkeeping around the decision made on
 * this screen, which is why it says what it is asking for in plain words
 * before either button: accepting means this person can invite you to their
 * events without asking for your email each time. Somebody who read that and
 * pressed Accept has agreed to something they understood, and that sentence is
 * the entire legal and ethical basis for every invitation that follows.
 *
 * Sign-in is required to answer, and the requirement is not friction to be
 * optimised away — a group membership has to name an account, because an
 * anonymous yes is a yes nobody can later withdraw.
 */
const getJoinPage = createServerFn({ method: "GET" })
  .validator((data: { joinToken: string }) => data)
  .handler(async ({ data }) => {
    const [
      { getOrganizer },
      { resolvePreferences },
      { countJoined, findGroupByJoinToken, findMembership },
      { groupJoinState },
      { db },
      { userProfiles },
      { eq },
    ] = await Promise.all([
      import("@/lib/organizer"),
      import("@/lib/preferences"),
      import("@/lib/groups"),
      import("@/domain/groups"),
      import("@/db/client"),
      import("@/db/schema"),
      import("drizzle-orm"),
    ]);

    const { copy } = await resolvePreferences();
    const group = await findGroupByJoinToken(data.joinToken);

    if (!group) {
      return { title: copy.groups.title, group: null, state: null, signedIn: false } as const;
    }

    const [owner] = await db
      .select({ name: userProfiles.fullName })
      .from(userProfiles)
      .where(eq(userProfiles.userId, group.ownerId))
      .limit(1);

    const reader = await getOrganizer();

    /*
      Not signed in: the group is still shown by name, so somebody deciding
      whether to make an account can see what they would be joining. The one
      thing they cannot do is answer.
    */
    if (!reader) {
      return {
        title: copy.groups.joinTitle(group.name),
        group: { id: group.id, name: group.name, ownerName: owner?.name ?? null },
        state: null,
        signedIn: false,
        signInHref: signInPath(groupJoinPath(data.joinToken)),
      } as const;
    }

    const membership = await findMembership(group.id, reader.id);
    const joinedCount = await countJoined(group.id);

    return {
      title: copy.groups.joinTitle(group.name),
      group: { id: group.id, name: group.name, ownerName: owner?.name ?? null },
      state: groupJoinState({
        isOwner: group.ownerId === reader.id,
        membership,
        joinedCount,
      }),
      signedIn: true,
    } as const;
  });

export const Route = createFileRoute("/g/$join_token")({
  loader: ({ params }) => getJoinPage({ data: { joinToken: params.join_token } }),
  head: ({ loaderData }) => ({
    meta: [
      { title: pageTitle(loaderData?.title) },
      // Not indexable. A join link is meant to travel through a chat, not a
      // search result — a group somebody can find is a group anybody can join.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: JoinGroupPage,
});

function JoinGroupPage() {
  const { copy } = useCopy();
  const data = Route.useLoaderData();
  const { join_token: joinToken } = Route.useParams();

  if (!data.group) {
    return (
      <Container size="2" px="4" py="6">
        <Text color="muted">{copy.groups.stateNotFound}</Text>
      </Container>
    );
  }

  const { group } = data;

  return (
    <Container size="2" px="4" py="6">
      {/* Whether a shared link turns into a membership is the only measure of
          whether groups work. `state` is what the reader was shown. */}
      <TrackView
        name="group_link_viewed"
        props={{ group_id: group.id, state: data.state ?? "signed_out" }}
      />

      <Card surface="outlined">
        <CardContent>
          <Stack gap="5">
            <Stack gap="2">
              <Text as="h1" variant="h3" fontFamily="var(--junti-display)">
                {copy.groups.joinHeading(group.name)}
              </Text>
              {/* Not shown to the owner: "you are inviting you" reads as a
                  bug, and they already know whose group it is. */}
              {group.ownerName && data.state !== "owner" ? (
                <Text color="muted">{copy.groups.joinInvitedBy(group.ownerName)}</Text>
              ) : null}
            </Stack>

            {data.signedIn ? (
              <Answer state={data.state} joinToken={joinToken} group={group} />
            ) : (
              <Stack gap="3">
                <Text variant="small" color="muted">
                  {copy.groups.joinSignInHelp}
                </Text>
                <Flex>
                  <Button asChild size="md" variant="primary">
                    <Link to={data.signInHref as never}>{copy.groups.joinSignIn}</Link>
                  </Button>
                </Flex>
              </Stack>
            )}
          </Stack>
        </CardContent>
      </Card>
    </Container>
  );
}

/**
 * The five things this page can say, one per state.
 *
 * Split out so the states read as a list rather than as a chain of ternaries —
 * whether a member can leave, whether somebody who declined can come back, and
 * whether an owner sees buttons at all are each one line here.
 */
function Answer({
  state,
  joinToken,
  group,
}: {
  state: GroupJoinState | null;
  joinToken: string;
  group: { id: string; name: string };
}) {
  const { copy } = useCopy();

  if (state === "owner") {
    return (
      <Stack gap="1">
        <Text weight="medium">{copy.groups.stateOwner}</Text>
        <Text variant="small" color="muted">
          {copy.groups.stateOwnerHelp}
        </Text>
      </Stack>
    );
  }

  if (state === "joined") {
    return (
      <Stack gap="3">
        <Stack gap="1">
          <Text weight="medium">{copy.groups.stateJoined(group.name)}</Text>
          <Text variant="small" color="muted">
            {copy.groups.stateJoinedHelp}
          </Text>
        </Stack>
        <Flex>
          <LeaveGroupControl groupId={group.id} name={group.name} />
        </Flex>
      </Stack>
    );
  }

  if (state === "declined") {
    return (
      <Stack gap="4">
        <Stack gap="1">
          <Text weight="medium">{copy.groups.stateDeclined(group.name)}</Text>
          <Text variant="small" color="muted">
            {copy.groups.stateDeclinedHelp}
          </Text>
        </Stack>
        {/* No second decline: they already said no, and the button would do
            nothing. Coming back is the only move left here. */}
        <AnswerGroupControls joinToken={joinToken} showDecline={false} />
      </Stack>
    );
  }

  if (state === "full") {
    return (
      <Stack gap="1">
        <Text weight="medium">{copy.groups.stateFull(group.name)}</Text>
        <Text variant="small" color="muted">
          {copy.groups.stateFullHelp(MAX_GROUP_MEMBERS)}
        </Text>
      </Stack>
    );
  }

  return (
    <Stack gap="4">
      <Text variant="small" color="muted">
        {copy.groups.joinExplainer}
      </Text>
      <AnswerGroupControls joinToken={joinToken} showDecline />
    </Stack>
  );
}
