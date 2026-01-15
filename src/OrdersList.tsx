import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";

type OrderStatus = "pending" | "sent" | "completed" | "cancelled";

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusLabel: Record<OrderStatus, string> = {
  pending: "Pendente",
  sent: "Enviado",
  completed: "Concluído",
  cancelled: "Cancelado",
};

export function OrdersList({ isAdmin }: { isAdmin: boolean }) {
  const orders = useQuery(api.orders.listOrders);
  const updateOrderStatus = useMutation(api.orders.updateOrderStatus);

  const handleStatusChange = async (orderId: Id<"orders">, status: OrderStatus) => {
    if (!isAdmin) return;

    try {
      await updateOrderStatus({ orderId, status });
      toast.success("Status atualizado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao atualizar status.");
    }
  };

  if (orders === undefined) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold mb-4">Pedidos Recentes</h2>
        <p className="text-gray-600">Carregando...</p>
      </div>
    );
  }

  if (!orders.length) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold mb-4">Pedidos Recentes</h2>
        <p className="text-gray-600">Nenhum pedido encontrado.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <h2 className="text-xl font-semibold mb-4">Pedidos Recentes</h2>

      <div className="space-y-4">
        {orders.map((order) => (
          <div key={order._id} className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-sm text-gray-500">{order.customerName}</div>
                <div className="font-semibold">{order.selectedMachine}</div>
                <div className="text-sm text-gray-600">
                  Quantidade: {order.quantity} • Pagamento: {order.paymentMethod}
                </div>
                <div className="text-sm text-gray-700 mt-1">
                  Total: <span className="font-semibold">{formatBRL(order.totalPrice)}</span>
                  {order.installmentPrice != null && order.paymentMethod === "parcelado" && (
                    <span className="text-gray-500"> (parcela: {formatBRL(order.installmentPrice)})</span>
                  )}
                </div>
              </div>

              <div className="flex flex-col items-end gap-2">
                <div className="text-sm text-gray-600">
                  Status: <span className="font-semibold">{statusLabel[order.status as OrderStatus]}</span
