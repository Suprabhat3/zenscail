"use client";

import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  return (
    <button
      onClick={async () => {
        await authClient.signOut();
        router.push("/login");
      }}
      className="text-neutral-400 hover:text-neutral-100"
    >
      Sign out
    </button>
  );
}
