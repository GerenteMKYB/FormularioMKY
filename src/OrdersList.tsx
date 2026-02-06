import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";

type OrderStatus = "pending" | "sent" | "completed" | "cancelled";

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusLabel: Record<OrderStatus, string> = {
    pending: "Aguardando Pagamento",
    sent: "Pago",
    sent: "Enviado",
    completed: "Concluído",
    cancelled: "Cancelado",
};

export function OrdersList({ isAdmin }: { isAdmin: boolean }) {
  const orders = useQuery(api.orders.listOrders);
  const updateOrderStatus = useMutation(api.orders.updateOrderStatus);

  const handleStatusChange = async (orderId: Id<"orders">, newStatus: OrderStatus) => {
    try {
      await updateOrderStatus({ orderId, status: newStatus });
      toast.success("Status atualizado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao atualizar status.");
    }
  };

  if (orders === undefined) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight mb-4">
          Pedidos Recentes
        </h2>
        <p className="text-sm text-white/60">Carregando...</p>
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight mb-4">
          Pedidos Recentes
        </h2>
        <p className="text-sm text-white/60">Nenhum pedido ainda.</p>
      </div>
    );
  }

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg sm:text-xl font-semibold tracking-tight mb-4">
        Pedidos Recentes
      </h2>

      <div className="space-y-3">
        {orders.map((order) => (
          <div
            key={order._id}
            className="rounded-2xl border border-white/10 bg-black/20 p-4 hover:bg-black/30 transition"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-sm text-white/60 truncate">{order.customerName}</div>
                <div className="font-semibold truncate">{order.selectedMachine}</div>

                <div className="text-sm text-white/70 tabular-nums mt-1">
                  Quantidade: {order.quantity} <span className="text-white/40">•</span>{" "}
                  Pagamento: {order.paymentMethod}
                </div>

                <div className="text-sm text-white/80 tabular-nums mt-1">
                  Total: <span className="font-semibold">{formatBRL(order.totalPrice)}</span>
                  {order.installmentPrice != null && order.paymentMethod === "parcelado" && (
                    <span className="text-white/60">
                      {" "}
                      ({order.installments ?? 12}x de {formatBRL(order.totalPrice / (order.installments ?? 12))})
                    </span>
                  )}
                </div>

                {order.deliveryAddress && (
                  <div className="text-sm text-white/70 mt-2 break-words">
                    Endereço: <span className="text-white/90">{order.deliveryAddress}</span>
                  </div>
                )}

                {order.machineType === "pagseguro" && order.pagSeguroEmail && (
                  <div className="text-sm text-white/70 mt-1 break-words">
                    E-mail PagSeguro: <span className="text-white/90">{order.pagSeguroEmail}</span>
                  </div>
                )}
              </div>

              <div className="flex flex-col items-end gap-2 flex-shrink-0">
                <div className="text-sm text-white/70">
                  Status:{" "}
                  <span className="font-semibold text-white">
                    {statusLabel[order.status as OrderStatus]}
                  </span>
                </div>

                {isAdmin && (
                  <select
                    value={order.status as OrderStatus}
                    onChange={(e) =>
                      handleStatusChange(order._id as Id<"orders">, e.target.value as OrderStatus)
                    }
                    className="text-xs px-2 py-1 rounded-lg border border-white/10 bg-black/30 text-white
                               focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
            <option value="pending">Aguardando Pagamento</option>
            <option value="sent">Pago</option>
            <option value="sent">Enviado</option>
            <option value="completed">Concluído</option>
            <option value="cancelled">Cancelado</option>
                    
                  </select>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
