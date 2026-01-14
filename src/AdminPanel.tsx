import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

type OrderStatus = "pending" | "sent" | "completed" | "cancelled";

export function AdminPanel() {
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);

  const queryArgs = useMemo(() => {
    return {
      limit,
      status: status === "all" ? undefined : (status as OrderStatus),
      search: search.trim() ? search.trim() : undefined,
    };
  }, [limit, search, status]);

  const orders = useQuery(api.admin.listAllOrders, queryArgs);
  const updateStatus = useMutation(api.admin.updateAnyOrderStatus);

  const statusLabel: Record<OrderStatus, string> = {
    pending: "Pendente",
    sent: "Enviado",
    completed: "Concluído",
    cancelled: "Cancelado",
  };

  if (orders === undefined) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="bg-white border rounded-xl shadow-sm p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Painel ADM</h2>
          <p className="text-sm text-gray-600">Visualize todos os pedidos e atualize o status.</p>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-center">
          <div className="flex flex-col">
            <label className="text-xs text-gray-500">Status</label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="all">Todos</option>
              <option value="pending">Pendente</option>
              <option value="sent">Enviado</option>
              <option value="completed">Concluído</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-500">Buscar</label>
            <input
              className="border rounded px-2 py-1 text-sm"
              placeholder="nome, telefone, email, máquina..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-col">
            <label className="text-xs text-gray-500">Limite</label>
            <select
              className="border rounded px-2 py-1 text-sm"
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>
        </div>
      </div>

      <div className="mt-4 overflow-auto">
        <table className="min-w-[980px] w-full border-collapse">
          <thead>
            <tr className="text-left text-xs text-gray-500 border-b">
              <th className="py-2 pr-4">Cliente</th>
              <th className="py-2 pr-4">Telefone</th>
              <th className="py-2 pr-4">Máquina</th>
              <th className="py-2 pr-4">Qtd</th>
              <th className="py-2 pr-4">Pagamento</th>
              <th className="py-2 pr-4">Total</th>
              <th className="py-2 pr-4">Status</th>
              <th className="py-2 pr-4">Criado em</th>
            </tr>
          </thead>
          <tbody>
            {orders.length === 0 ? (
              <tr>
                <td className="py-3 text-sm text-gray-500" colSpan={8}>
                  Nenhum pedido encontrado com os filtros atuais.
                </td>
              </tr>
            ) : (
              orders.map((o) => (
                <tr key={o._id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4 text-sm">{o.customerName}</td>
                  <td className="py-2 pr-4 text-sm">{o.customerPhone}</td>
                  <td className="py-2 pr-4 text-sm">{o.selectedMachine}</td>
                  <td className="py-2 pr-4 text-sm">{o.quantity}</td>
                  <td className="py-2 pr-4 text-sm">{o.paymentMethod}</td>
                  <td className="py-2 pr-4 text-sm">R$ {o.totalPrice.toFixed(2)}</td>
                  <td className="py-2 pr-4">
                    <select
                      className="border rounded px-2 py-1 text-sm"
                      value={o.status}
                      onChange={(e) =>
                        updateStatus({
                          orderId: o._id as Id<"orders">,
                          status: e.target.value as OrderStatus,
                        })
                      }
                    >
                      <option value="pending">{statusLabel.pending}</option>
                      <option value="sent">{statusLabel.sent}</option>
                      <option value="completed">{statusLabel.completed}</option>
                      <option value="cancelled">{statusLabel.cancelled}</option>
                    </select>
                  </td>
                  <td className="py-2 pr-4 text-xs text-gray-500">
                    {new Date(o._creationTime).toLocaleString("pt-BR")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
