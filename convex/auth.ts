import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { query } from "./_generated/server";
import { ResendOTPPasswordReset } from "./ResendOTPPasswordReset";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  // Removido login anônimo: apenas login por senha (email+password).
  providers: [Password({ reset: ResendOTPPasswordReset })],
});

function parseAdminEmails(raw: string | undefined | null): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,;]+/g)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

export const loggedInUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get("users", userId);
    return user ?? null;
  },
});

/**
 * Retorna informações consistentes para o front:
 * - email (se existir)
 * - isAnonymous (sempre false; login anônimo desabilitado)
 * - isAdmin (se email estiver em ADMIN_EMAILS)
 */
export const authInfo = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      return {
        isAuthenticated: false,
        isAnonymous: false,
        isAdmin: false,
        email: null as string | null,
        userId: null as string | null,
      };
    }

    const user = await ctx.db.get("users", userId);
    const email = ((user as any)?.email as string | undefined)?.toLowerCase() ?? null;

    const isAnonymous = false;

    const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);
    const isAdmin = !!email && adminEmails.has(email);

    return {
      isAuthenticated: true,
      isAnonymous,
      isAdmin,
      email,
      userId: userId.toString(),
    };
  },
});
