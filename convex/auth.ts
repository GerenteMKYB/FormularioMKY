import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { query } from "./_generated/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Password, Anonymous],
});

export const loggedInUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    const user = await ctx.db.get("users", userId);
    return user ?? null;
  },
});

/**
 * Informação confiável para UI:
 * - isAnonymous: baseado no usuário salvo em "users", não no identity.email.
 */
export const authInfo = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);

    if (!userId) {
      return {
        isAuthenticated: false,
        isAnonymous: false,
        email: null as string | null,
        userId: null as string | null,
      };
    }

    const user = await ctx.db.get("users", userId);

    const email = (user as any)?.email ?? null;
    const isAnonymous = !email;

    return {
      isAuthenticated: true,
      isAnonymous,
      email,
      userId: userId.toString(),
    };
  },
});
