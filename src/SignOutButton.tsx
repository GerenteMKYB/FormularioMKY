"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";

export function SignOutButton() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <button
      className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 text-white font-semibold hover:bg-white/10 transition"
      onClick={() => void signOut()}
    >
      Sair
    </button>
  );
}
