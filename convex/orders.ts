import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

function parseAdminEmails(raw: string | undefined | null): Set<string> {
  if (!raw) return new Set();
  return new Set(
    raw
      .split(/[,;]+/g)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function requireAdmin(ctx: any) {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new Error("Você precisa estar logado.");

  const user = await ctx.db.get(userId);
  const email = ((user as any)?.email as string | undefined)?.toLowerCase() ?? null;

  const adminEmails = parseAdminEmails(process.env.ADMIN_EMAILS);
  if (!email || !adminEmails.has(email)) {
    throw new Error("Acesso restrito ao administrador.");
  }
  return { userId, email };
}

export const createOrder = mutation({
  args: {
    customerName: v.string(),
    customerPhone: v.string(),
    customerEmail: v.optional(v.string()),
    deliveryAddress: v.string(),

    machineType: v.union(v.literal("pagseguro"), v.literal("subadquirente")),
    selectedMachine: v.string(),
    quantity: v.number(),

    paymentMethod: v.union(v.literal("avista"), v.literal("parcelado")),
    totalPrice: v.number(),
    installments: v.optional(v.number()),
    installmentPrice: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Você precisa estar logado para enviar um pedido.");

    const user = await ctx.db.get(userId);
    const userEmail = ((user as any)?.email as string | undefined) ?? undefined;

    await ctx.db.insert("orders", {
      userId,
      userEmail,
      customerName: args.customerName,
      customerPhone: args.customerPhone,
      customerEmail: args.customerEmail,
      deliveryAddress: args.deliveryAddress,

      machineType: args.machineType,
      selectedMachine: args.selectedMachine,
      quantity: args.quantity,

      paymentMethod: args.paymentMethod,
      totalPrice: args.totalPrice,
      installments: args.installments,
      installmentPrice: args.installmentPrice,

      status: "pending",
      whatsappSent: false,
    });

    return { ok: true };
  },
});

export const listOrders = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    return await ctx.db
      .query("orders")
      .withIndex("by_userId", (q: any) => q.eq("userId", userId))
      .order("desc")
      .take(20);
  },
});

// Mantido por compatibilidade com o frontend (controle de status na lista).
// Restrito a administradores.
export const updateOrderStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("completed"),
      v.literal("cancelled"),
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
