import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";
import { toast } from "sonner";

type OrderStatus = "pending" | "sent" | "completed" | "cancelled";

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function formatDateTime(ms?: number) {
  if (!ms) return "—";
  try {
    return new Date(ms).toLocaleString("pt-BR");
  } catch {
    return "—";
  }
}

function humanPayment(method: string) {
  if (method === "avista") return "À vista";
  if (method === "parcelado") return "Parcelado";
  return method;
}

function humanMachineType(t: string) {
  if (t === "pagseguro") return "PagSeguro";
  if (t === "subadquirente") return "Sub";
  return t;
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="mb-4">
        <div className="text-base font-semibold tracking-tight">{title}</div>
        {subtitle && <div className="mt-1 text-xs text-white/60">{subtitle}</div>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="text-xs text-white/60">{label}</div>
      <div className="mt-1 text-sm text-white/90 break-words">{value}</div>
    </div>
  );
}

export function AdminPanel() {
  const [status, setStatus] = useState<OrderStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [limit, setLimit] = useState(50);
  const [selected, setSelected] = useState<any | null>(null);

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
    pending: "Aguardando Pagamento",
    sent: "Pago",
    sent: "Enviado",
    completed: "Concluído",
    cancelled: "Cancelado",
  };

  async function handleStatusChange(orderId: Id<"orders">, newStatus: OrderStatus) {
    try {
      await updateStatus({ orderId, status: newStatus });
      toast.success("Status atualizado.");
    } catch (e: any) {
      toast.error(e?.message ?? "Não foi possível atualizar o status.");
    }
  }

  const openDetails = (o: any) => setSelected(o);
  const closeDetails = () => setSelected(null);

  return (
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
        <div className="min-w-0">
          <h2 className="text-lg sm:text-xl font-semibold tracking-tight">Painel ADM</h2>
          <p className="text-sm text-white/60">
            Visualize, filtre e atualize pedidos. Inclui endereço, parcelas e e-mail PagSeguro.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <input
            className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder:text-white/40
                       focus:outline-none focus:ring-2 focus:ring-primary/30"
            placeholder="Buscar (nome, telefone, e-mail, PagSeguro, endereço, maquininha...)"
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
            <option value="pending">Aguardando Pagamento</option>
            <option value="sent">Pago</option>
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
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70">Tipo</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70">Qtd</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70">Pagamento</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70">Parcelas</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70">Total</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70">E-mail PagSeguro</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70">Endereço</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70">Status</th>
              <th className="text-left py-2 px-3 text-xs font-semibold text-white/70">Detalhes</th>
            </tr>
          </thead>

          <tbody>
            {orders?.map((o) => {
              const parcelas =
                o.paymentMethod === "parcelado" ? `${o.installments ?? 12}x` : "—";

              const pagSeguroEmail =
                o.machineType === "pagseguro" ? (o.pagSeguroEmail ?? "—") : "—";

              const parcelaUnitaria =
                o.paymentMethod === "parcelado" && o.installmentPrice != null
                  ? formatBRL(o.installmentPrice)
                  : null;

              return (
                <tr key={o._id} className="border-b border-white/10 last:border-b-0">
                  <td className="py-2 px-3 text-sm text-white/90 whitespace-nowrap">{o.customerName}</td>
                  <td className="py-2 px-3 text-sm text-white/80 whitespace-nowrap">{o.customerPhone}</td>
                  <td className="py-2 px-3 text-sm text-white/70 whitespace-nowrap">{o.userEmail ?? "—"}</td>
                  <td className="py-2 px-3 text-sm text-white/90 whitespace-nowrap">{o.selectedMachine}</td>
                  <td className="py-2 px-3 text-sm text-white/80 whitespace-nowrap">{humanMachineType(o.machineType)}</td>
                  <td className="py-2 px-3 text-sm text-white/80 tabular-nums whitespace-nowrap">{o.quantity}</td>
                  <td className="py-2 px-3 text-sm text-white/80 whitespace-nowrap">{humanPayment(o.paymentMethod)}</td>
                  <td className="py-2 px-3 text-sm text-white/80 tabular-nums whitespace-nowrap">{parcelas}</td>

                  <td className="py-2 px-3 text-sm text-white/90 tabular-nums whitespace-nowrap">
                    <div>{formatBRL(o.totalPrice)}</div>
                    {parcelaUnitaria && (
                      <div className="text-xs text-white/60 whitespace-nowrap">
                        {o.installments ?? 12}x de {parcelaUnitaria}
                      </div>
                    )}
                  </td>

                  <td className="py-2 px-3 text-sm text-white/70 min-w-[220px]">
                    <div className="break-words">{pagSeguroEmail}</div>
                  </td>

                  <td className="py-2 px-3 text-sm text-white/70 min-w-[320px]">
                    <div className="break-words">{o.deliveryAddress ?? "—"}</div>
                  </td>

                  <td className="py-2 px-3">
                    <select
                      className="rounded-xl border border-white/10 bg-black/20 px-2 py-1 text-sm text-white
                                 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={o.status}
                      onChange={(e) =>
                        handleStatusChange(o._id as Id<"orders">, e.target.value as any)
                      }
                    >
                      <option value="pending">Aguardando Pagamento</option>
                      <option value="sent">Enviado</option>
                      <option value="completed">Concluído</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </td>

                  <td className="py-2 px-3">
                    <button
                      type="button"
                      className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-semibold"
                      onClick={() => openDetails(o)}
                    >
                      Ver
                    </button>
                  </td>
                </tr>
              );
            })}

            {!orders?.length && (
              <tr>
                <td className="py-4 px-3 text-sm text-white/60" colSpan={13}>
                  Nenhum pedido encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal: detalhes do pedido (layout inspirado no formulário preenchido) */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60" onClick={closeDetails} />

          <div className="relative w-full max-w-4xl rounded-3xl border border-white/10 bg-[#0b0c10] p-5 shadow-lg">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-lg font-semibold tracking-tight">Detalhes do pedido</div>
                <div className="mt-1 text-xs text-white/60 break-words">
                  ID: <span className="text-white/80">{String(selected._id)}</span> • Criado em:{" "}
                  <span className="text-white/80">{formatDateTime(selected._creationTime)}</span>
                </div>
              </div>

              <button
                type="button"
                className="px-4 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                onClick={closeDetails}
              >
                Fechar
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 xl:grid-cols-12 gap-5">
              <div className="xl:col-span-8 space-y-5">
                <SectionCard title="Dados do cliente">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Field label="Nome" value={selected.customerName ?? "—"} />
                    <Field label="Telefone" value={selected.customerPhone ?? "—"} />
                    <Field label="E-mail informado" value={selected.customerEmail ?? "—"} />
                    <Field label="E-mail da conta (login)" value={selected.userEmail ?? "—"} />
                    <Field
                      label="E-mail PagSeguro"
                      value={
                        selected.machineType === "pagseguro"
                          ? selected.pagSeguroEmail ?? "—"
                          : "—"
                      }
                    />
                  </div>
                </SectionCard>

                <SectionCard title="Entrega">
                  <Field label="Endereço" value={selected.deliveryAddress ?? "—"} />
                </SectionCard>

                <SectionCard title="Maquininha">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Field label="Tipo" value={humanMachineType(selected.machineType)} />
                    <Field label="Modelo" value={selected.selectedMachine ?? "—"} />
                    <Field label="Quantidade" value={selected.quantity ?? "—"} />
                  </div>
                </SectionCard>
              </div>

              <div className="xl:col-span-4 space-y-5">
                <SectionCard title="Pagamento e resumo" subtitle="Visualização consolidada do que foi escolhido.">
                  <div className="space-y-3">
                    <Field label="Forma" value={humanPayment(selected.paymentMethod)} />

                    {selected.paymentMethod === "parcelado" ? (
                      <>
                        <Field label="Parcelas" value={`${selected.installments ?? 12}x`} />
                        <Field
                          label="Parcela unitária"
                          value={
                            selected.installmentPrice != null
                              ? formatBRL(selected.installmentPrice)
                              : "—"
                          }
                        />
                      </>
                    ) : (
                      <Field label="Parcelas" value="—" />
                    )}

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs text-white/60">Total</div>
                      <div className="mt-1 text-2xl font-semibold text-green-500 tabular-nums whitespace-nowrap">
                        {formatBRL(selected.totalPrice ?? 0)}
                      </div>

                      {selected.paymentMethod === "parcelado" && selected.installmentPrice != null && (
                        <div className="mt-1 text-xs text-white/60 tabular-nums whitespace-nowrap">
                          {selected.installments ?? 12}x de {formatBRL(selected.installmentPrice)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="text-xs text-white/60 mb-2">Status</div>
                    <select
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white
                                 focus:outline-none focus:ring-2 focus:ring-primary/30"
                      value={selected.status as OrderStatus}
                      onChange={(e) => {
                        const newStatus = e.target.value as OrderStatus;
                        handleStatusChange(selected._id as Id<"orders">, newStatus);
                        setSelected((p: any) => (p ? { ...p, status: newStatus } : p));
                      }}
                    >
                      <option value="pending">Aguardando Pagamento</option>
                      <option value="sent">Enviado</option>
                      <option value="completed">Concluído</option>
                      <option value="cancelled">Cancelado</option>
                    </select>
                  </div>
                </SectionCard>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
