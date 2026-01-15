import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

type OrderStatus = "pending" | "sent" | "completed" | "cancelled";

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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

  return (
    <div className="bg-white p-6 rounded-lg shadow-sm border">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold">Painel ADM</h2>
          <p className="text-sm text-gray-600">
            Visualize e atualize os pedidos (admin).
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <input
            className="border rounded px-3 py-2 text-sm"
            placeholder="Buscar (nome, telefone, e-mail, maquininha...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="border rounded px-3 py-2 text-sm"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="all">Todos</option>
            <option value="pending">Pendente</option>
            <option value="sent">Enviado</option>
            <option value="completed">Concluído</option>
            <option value="cancelled">Cancelado</option>
          </select>

          <select
            className="border rounded px-3 py-2 text-sm"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <div className="overflow-auto">
        <table className="min-w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4">Nome</th>
              <th className="text-left py-2 pr-4">Telefone</th>
              <th className="text-left py-2 pr-4">E-mail (conta)</th>
              <th className="text-left py-2 pr-4">Maquininha</th>
              <th className="text-left py-2 pr-4">Qtd</th>
              <th className="text-left py-2 pr-4">Pagamento</th>
              <th className="text-left py-2 pr-4">Total</th>
              <th className="text-left py-2 pr-4">Status</th>
            </tr>
          </thead>

          <tbody>
            {orders?.map((o) => (
              <tr key={o._id} className="border-b last:border-b-0">
                <td className="py-2 pr-4 text-sm">{o.customerName}</td>
                <td className="py-2 pr-4 text-sm">{o.customerPhone}</td>
                <td className="py-2 pr-4 text-sm">{(o as any).userEmail ?? "—"}</td>
                <td className="py-2 pr-4 text-sm">{o.selectedMachine}</td>
                <td className="py-2 pr-4 text-sm">{o.quantity}</td>
                <td className="py-2 pr-4 text-sm">{o.paymentMethod}</td>
                <td className="py-2 pr-4 text-sm">{formatBRL(o.totalPrice)}</td>
                <td className="py-2 pr-4">
                  <select
                    className="border rounded px-2 py-1 text-sm"
                    value={o.status}
                    onChange={(e) =>
                      updateStatus({
                        orderId: o._id as Id<"orders">,
                        status: e.target.value as any,
                      })
                    }
                  >
                    <option value="pending">{statusLabel.pending}</option>
                    <option value="sent">{statusLabel.sent}</option>
                    <option value="completed">{statusLabel.completed}</option>
                    <option value="cancelled">{statusLabel.cancelled}</option>
                  </select>
                </td>
              </tr>
            ))}
            {!orders?.length && (
              <tr>
                <td className="py-4 text-sm text-gray-600" colSpan={8}>
                  Nenhum pedido encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
