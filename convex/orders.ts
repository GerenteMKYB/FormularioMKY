import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

export const createOrder = mutation({
  args: {
    customerName: v.string(),
    customerPhone: v.string(),
    customerEmail: v.optional(v.string()),
    machineType: v.union(v.literal("pagseguro"), v.literal("subadquirente")),
    selectedMachine: v.string(),
    quantity: v.number(),
    paymentMethod: v.union(v.literal("avista"), v.literal("parcelado")),
    totalPrice: v.number(),
    installmentPrice: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new Error("Você precisa estar autenticado para enviar um pedido.");
    }

    const orderId = await ctx.db.insert("orders", {
      createdBy: userId,

      customerName: args.customerName,
      customerPhone: args.customerPhone,
      customerEmail: args.customerEmail,

      machineType: args.machineType,
      selectedMachine: args.selectedMachine,
      quantity: args.quantity,
      paymentMethod: args.paymentMethod,

      totalPrice: args.totalPrice,
      installmentPrice: args.installmentPrice,

      status: "pending",
      whatsappSent: false,
    });

    return orderId;
  },
});

/**
 * Lista SOMENTE os pedidos do usuário autenticado.
 * (É isso que você quer para “Pedidos Recentes”.)
 */
export const listMyOrders = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const limit = Math.min(Math.max(args.limit ?? 20, 1), 100);

    return await ctx.db
      .query("orders")
      .withIndex("by_createdBy", (q) => q.eq("createdBy", userId))
      .order("desc")
      .take(limit);
  },
});

/**
 * (Opcional) Atualização de status — deixe isso apenas para admin se quiser.
 * Por enquanto, mantive simples: exige autenticação e permite atualizar só pedidos do próprio usuário.
 * Se você quiser que APENAS você (gerente) altere status, eu ajusto em 30 segundos.
 */
export const updateOrderStatus = mutation({
  args: {
    orderId: v.id("orders"),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("completed"),
      v.literal("cancelled")
    ),
    whatsappSent: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Não autorizado.");

    const existing = await ctx.db.get(args.orderId);
    if (!existing) throw new Error("Pedido não encontrado.");

    // Segurança: só permite mexer em pedido próprio
    if (existing.createdBy && existing.createdBy !== userId) {
      throw new Error("Não autorizado para alterar pedido de outro usuário.");
    }

    const { orderId, ...updates } = args;
    await ctx.db.patch(orderId, updates);
  },
});
