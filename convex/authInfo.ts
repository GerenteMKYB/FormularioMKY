import { getAuthUserId } from "@convex-dev/auth/server";
import { query } from "./_generated/server";

function parseAdminEmails(raw?: string | null): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,;]+/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

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
    const email =
      ((user as any)?.email as string | undefined)?.toLowerCase() ?? null;

    const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);
    const isAdmin = !!email && adminEmails.has(email);

    return {
      isAuthenticated: true,
      isAnonymous: false,
      isAdmin,
      email,
      userId: userId.toString(),
    };
  },
});
