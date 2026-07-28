"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Button } from "@stackmyth/button";

import { copy } from "@/config/copy";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

export function SignOutButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function signOut() {
    startTransition(async () => {
      await createSupabaseBrowserClient().auth.signOut();
      // refresh() re-runs the server components so the session disappears
      // everywhere at once, not just on this page.
      router.refresh();
      router.push("/");
    });
  }

  return (
    <Button type="button" variant="ghost" size="md" onClick={signOut} disabled={pending}>
      {copy.auth.signOut}
    </Button>
  );
}
