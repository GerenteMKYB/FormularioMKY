import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

function parseAdminEmails(raw: string | undefined | null): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,;]+/g)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );
}

async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Não autorizado.");

  const user = await ctx.db.get(userId);
  const email = (user?.email as string | undefined)?.toLowerCase() ?? null;

  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);
  if (!email || !adminEmails.has(email)) {
    throw new Error("Acesso restrito ao administrador.");
  }
  return { userId, email };
}

export const listAllOrders = query({
  args: {
    limit: v.optional(v.number()),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("sent"),
        v.literal("completed"),
        v.literal("cancelled")
      )
    ),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const limit = args.limit ?? 50;

    let q = ctx.db.query("orders").order("desc");
    if (args.status) {
      q = q.filter((f: any) => f.eq(f.field("status"), args.status));
    }

    const rows = await q.take(limit);

    // Filtro simples por texto no lado do servidor (para limitar o que vai para o client)
    if (args.search) {
      const s = args.search.toLowerCase();
      return rows.filter((o: any) => {
        const hay = `${o.customerName ?? ""} ${o.customerPhone ?? ""} ${o.customerEmail ?? ""} ${o.userEmail ?? ""} ${o.selectedMachine ?? ""} ${o.pagSeguroEmail ?? ""} ${o.deliveryAddress ?? ""}`.toLowerCase();
        return hay.includes(s);
      });
    }

    return rows;
  },
});

export const updateAnyOrderStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);

    const existing = await ctx.db.get(args.orderId);
    if (!existing) throw new Error("Pedido não encontrado.");

    await ctx.db.patch(args.orderId, { status: args.status });
    return { ok: true };
  },
});
