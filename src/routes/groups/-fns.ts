import { createServerFn } from "@tanstack/react-start";

import type { GroupState } from "./-actions.server";

/**
 * The four group mutations, as server functions.
 *
 * Thin RPC wrappers over the server-only module, which stays behind dynamic
 * imports — a route file ships to the client whether or not it has a
 * component, so the import has to happen inside the handler.
 */

export type { GroupState };

export const createGroupFn = createServerFn({ method: "POST" })
  .validator((data: FormData) => data)
  .handler(async ({ data }): Promise<GroupState> => {
    const { createGroup } = await import("./-actions.server");
    return createGroup(data);
  });

export const deleteGroupFn = createServerFn({ method: "POST" })
  .validator((data: { groupId: string }) => data)
  .handler(async ({ data }): Promise<GroupState> => {
    const { deleteGroup } = await import("./-actions.server");
    return deleteGroup(data.groupId);
  });

export const answerGroupFn = createServerFn({ method: "POST" })
  .validator((data: { joinToken: string; answer: "joined" | "declined" }) => data)
  .handler(async ({ data }): Promise<GroupState> => {
    const { answerGroup } = await import("./-actions.server");
    return answerGroup(data.joinToken, data.answer);
  });

export const leaveGroupFn = createServerFn({ method: "POST" })
  .validator((data: { groupId: string }) => data)
  .handler(async ({ data }): Promise<GroupState> => {
    const { leaveGroup } = await import("./-actions.server");
    return leaveGroup(data.groupId);
  });
