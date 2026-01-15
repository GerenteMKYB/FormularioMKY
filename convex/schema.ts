import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  orders: defineTable({
    // Identifica o usuário autenticado (inclui login anônimo).
    // Optional para não quebrar registros legados já existentes na tabela.
    userId: v.optional(v.id("users")),
    // Email do usuário autenticado (quando disponível). Útil para auditoria/admin.
    userEmail: v.optional(v.string()),

    customerName: v.string(),
    customerPhone: v.string(),
    customerEmail: v.optional(v.string()),
    deliveryAddress: v.string(),

    machineType: v.union(v.literal("pagseguro"), v.literal("subadquirente")),
    selectedMachine: v.string(),

    quantity: v.number(),

    paymentMethod: v.union(v.literal("avista"), v.literal("parcelado")),
    totalPrice: v.number(),
    installmentPrice: v.optional(v.number()),

    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("completed"),
      v.literal("cancelled"),
    ),

    whatsappSent: v.boolean(),
  }).index("by_userId", ["userId"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
