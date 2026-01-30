import { Fragment, useMemo, useState } from "react";
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
  const [openId, setOpenId] = useState<string | null>(null);

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
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight">Painel ADM</h2>
          <p className="text-sm text-white/60">
            Visualize e atualize pedidos. Clique em <span className="text-white/80">Detalhes</span> para ver tudo já preenchido.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <input
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/40
                       focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Buscar (nome, telefone, e-mail, maquininha...)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <select
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white
                       focus:outline-none focus:ring-2 focus:ring-primary/30"
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
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white
                       focus:outline-none focus:ring-2 focus:ring-primary/30"
            value={limit}
            onChange={(e) => setLimit(Number(e.target.value))}
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <div className="overflow-auto rounded-2xl border border-white/10">
        <table className="min-w-full">
          <thead className="bg-black/20">
            <tr className="border-b border-white/10">
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70">Nome</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70">Telefone</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70">E-mail (conta)</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70">Maquininha</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70">Qtd</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70">Pagamento</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70">Parcelas</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70">E-mail PagSeguro</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70">Total</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70">Status</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70"> </th>
            </tr>
          </thead>

          <tbody>
            {orders?.map((o) => {
              const anyO = o as any;
              const isOpen = openId === o._id;
              const parcelas =
                o.paymentMethod === "parcelado" ? (anyO.installments ?? "—") : "—";
              const pagSeguroEmail =
                anyO.machineType === "pagseguro" ? (anyO.pagSeguroEmail ?? "—") : "—";

              return (
                <Fragment key={o._id}>
                  <tr className="border-b border-white/10">
                    <td className="py-2 px-3 text-sm text-white/90 whitespace-nowrap">{o.customerName}</td>
                    <td className="py-2 px-3 text-sm text-white/80 whitespace-nowrap">{o.customerPhone}</td>
                    <td className="py-2 px-3 text-sm text-white/70 whitespace-nowrap">
                      {anyO.userEmail ?? "—"}
                    </td>
                    <td className="py-2 px-3 text-sm text-white/90 whitespace-nowrap">{o.selectedMachine}</td>
                    <td className="py-2 px-3 text-sm text-white/80 tabular-nums whitespace-nowrap">{o.quantity}</td>
                    <td className="py-2 px-3 text-sm text-white/80 whitespace-nowrap">{o.paymentMethod}</td>
                    <td className="py-2 px-3 text-sm text-white/80 tabular-nums whitespace-nowrap">{parcelas}</td>
                    <td className="py-2 px-3 text-sm text-white/80 whitespace-nowrap">{pagSeguroEmail}</td>
                    <td className="py-2 px-3 text-sm text-white/90 tabular-nums whitespace-nowrap">
                      {formatBRL(o.totalPrice)}
                    </td>

                    <td className="py-2 px-3">
                      <select
                        className="rounded-xl border border-white/10 bg-black/20 px-2 py-1 text-sm text-white
                                   focus:outline-none focus:ring-2 focus:ring-primary/30"
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

                    <td className="py-2 px-3">
                      <button
                        type="button"
                        onClick={() => setOpenId((prev) => (prev === o._id ? null : o._id))}
                        className="text-xs px-3 py-1 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10"
                      >
                        {isOpen ? "Fechar" : "Detalhes"}
                      </button>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className="border-b border-white/10 last:border-b-0">
                      <td colSpan={11} className="px-3 py-3">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div>
                              <div className="text-xs text-white/50 mb-1">Dados do cliente</div>
                              <div className="text-sm text-white/90"><span className="text-white/60">Nome:</span> {o.customerName}</div>
                              <div className="text-sm text-white/90"><span className="text-white/60">Telefone:</span> {o.customerPhone}</div>
                              <div className="text-sm text-white/90"><span className="text-white/60">E-mail:</span> {anyO.customerEmail ?? "—"}</div>
                              <div className="text-sm text-white/90"><span className="text-white/60">E-mail (conta):</span> {anyO.userEmail ?? "—"}</div>
                            </div>

                            <div>
                              <div className="text-xs text-white/50 mb-1">Entrega</div>
                              <div className="text-sm text-white/90 break-words">
                                <span className="text-white/60">Endereço:</span> {anyO.deliveryAddress ?? "—"}
                              </div>
                            </div>

                            <div>
                              <div className="text-xs text-white/50 mb-1">Maquininha</div>
                              <div className="text-sm text-white/90"><span className="text-white/60">Tipo:</span> {anyO.machineType}</div>
                              <div className="text-sm text-white/90"><span className="text-white/60">Modelo:</span> {o.selectedMachine}</div>
                              <div className="text-sm text-white/90"><span className="text-white/60">Quantidade:</span> {o.quantity}</div>
                              {anyO.machineType === "pagseguro" && (
                                <div className="text-sm text-white/90 break-words">
                                  <span className="text-white/60">E-mail PagSeguro:</span> {anyO.pagSeguroEmail ?? "—"}
                                </div>
                              )}
                            </div>

                            <div>
                              <div className="text-xs text-white/50 mb-1">Pagamento</div>
                              <div className="text-sm text-white/90"><span className="text-white/60">Método:</span> {o.paymentMethod}</div>
                              <div className="text-sm text-white/90">
                                <span className="text-white/60">Total:</span> {formatBRL(o.totalPrice)}
                              </div>
                              {o.paymentMethod === "parcelado" && (
                                <>
                                  <div className="text-sm text-white/90">
                                    <span className="text-white/60">Parcelas:</span> {anyO.installments ?? 12}x
                                  </div>
                                  <div className="text-sm text-white/90">
                                    <span className="text-white/60">Parcela unitária:</span>{" "}
                                    {anyO.installmentPrice != null ? formatBRL(anyO.installmentPrice) : "—"}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}

            {!orders?.length && (
              <tr>
                <td className="py-4 px-3 text-sm text-white/60" colSpan={11}>
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
