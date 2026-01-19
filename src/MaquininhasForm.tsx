import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";

type Tier = { min: number; max?: number; unitPrice: number };

type MachineOption = {
  name: string;
  price?: number; // à vista (unitário)
  installmentPrice?: number; // parcela unitária fixa (quando fornecida)
  installments?: number; // default 12
  tiers?: Tier[]; // usado para S920
  allowAutoInstallment?: boolean; // se true, calcula parcela = unit/12
};

type ViaCepResponse = {
  cep?: string;
  logradouro?: string;
  complemento?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function onlyDigits(s: string) {
  return (s ?? "").replace(/\D/g, "");
}

function clampQty(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.min(Math.max(Math.trunc(n), 1), 1000);
}

function getUnitPrice(machine: MachineOption, quantity: number): number {
  if (machine.tiers?.length) {
    const q = clampQty(quantity);
    const tier =
      machine.tiers.find((t) => q >= t.min && (t.max == null || q <= t.max)) ??
      machine.tiers[machine.tiers.length - 1];
    return tier.unitPrice;
  }
  return machine.price ?? 0;
}

function getUnitInstallment(machine: MachineOption, quantity: number): number | undefined {
  if (machine.installmentPrice != null) return machine.installmentPrice;

  if (machine.allowAutoInstallment) {
    const installments = machine.installments ?? 12;
    const unit = getUnitPrice(machine, quantity);
    if (unit <= 0 || installments <= 0) return undefined;
    return unit / installments;
  }
  return undefined;
}

// Catálogo (conforme solicitado)
const pagSeguroMachines: MachineOption[] = [
  { name: "Smart", price: 196.08, installmentPrice: 16.34, installments: 12 },
  { name: "Moderninha Pro", price: 107.88, installmentPrice: 8.99, installments: 12 },
  { name: "Minizinha Chip", price: 47.88, installmentPrice: 3.99, installments: 12 },
];

const subMachines: MachineOption[] = [
  { name: "POS A960", price: 826.0, installmentPrice: 69.0, installments: 12 },
  {
    name: "S920",
    tiers: [
      { min: 1, max: 10, unitPrice: 525.0 },
      { min: 11, max: 19, unitPrice: 475.0 },
      { min: 20, max: 49, unitPrice: 425.0 },
      { min: 50, max: 99, unitPrice: 375.0 },
      { min: 100, unitPrice: 325.0 },
    ],
    installments: 12,
    allowAutoInstallment: true, // parcela calculada (sem juros)
  },
];

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
    <div className="rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="mb-5">
        <h2 className="text-lg sm:text-xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-white/60">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}

export function MaquininhasForm() {
  const createOrder = useMutation(api.orders.createOrder);

  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",

    // Endereço em campos
    deliveryCep: "",
    deliveryStreet: "",
    deliveryNumber: "",
    deliveryComplement: "",
    deliveryNeighborhood: "",
    deliveryCity: "",
    deliveryState: "",

    machineType: "subadquirente" as "pagseguro" | "subadquirente",
    selectedMachine: "",
    quantity: 1,
    paymentMethod: "avista" as "avista" | "parcelado",
  });

  // Para não sobrescrever edições manuais após ViaCEP
  const editedRef = useRef({
    street: false,
    complement: false,
    neighborhood: false,
    city: false,
    state: false,
  });

  const machines = useMemo(
    () => (formData.machineType === "pagseguro" ? pagSeguroMachines : subMachines),
    [formData.machineType],
  );

  const selectedMachine = useMemo(
    () => machines.find((m) => m.name === formData.selectedMachine),
    [machines, formData.selectedMachine],
  );

  const qty = clampQty(formData.quantity);

  const totals = useMemo(() => {
    if (!selectedMachine) {
      return {
        unitPrice: 0,
        totalAvista: 0,
        installments: 12,
        unitInstallment: undefined as number | undefined,
        totalInstallment: undefined as number | undefined,
      };
    }
    const unitPrice = getUnitPrice(selectedMachine, qty);
    const totalAvista = unitPrice * qty;

    const installments = selectedMachine.installments ?? 12;
    const unitInstallment = getUnitInstallment(selectedMachine, qty);
    const totalInstallment = unitInstallment != null ? unitInstallment * qty : undefined;

    return { unitPrice, totalAvista, installments, unitInstallment, totalInstallment };
  }, [selectedMachine, qty]);

  // CEP -> ViaCEP (auto-preenche rua/bairro/cidade/uf/complemento quando possível)
  useEffect(() => {
    const cepDigits = onlyDigits(formData.deliveryCep);

    if (formData.deliveryCep !== cepDigits) {
      setFormData((p) => ({ ...p, deliveryCep: cepDigits }));
      return;
    }
    if (cepDigits.length !== 8) return;

    let cancelled = false;

    const t = setTimeout(async () => {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, { method: "GET" });
        if (!res.ok) throw new Error("Falha ao consultar CEP.");
        const data = (await res.json()) as ViaCepResponse;

        if (data.erro) {
          toast.error("CEP não encontrado.");
          return;
        }
        if (cancelled) return;

        setFormData((p) => ({
          ...p,
          deliveryStreet: editedRef.current.street ? p.deliveryStreet : (data.logradouro ?? p.deliveryStreet ?? ""),
          deliveryNeighborhood: editedRef.current.neighborhood
            ? p.deliveryNeighborhood
            : (data.bairro ?? p.deliveryNeighborhood ?? ""),
          deliveryCity: editedRef.current.city ? p.deliveryCity : (data.localidade ?? p.deliveryCity ?? ""),
          deliveryState: editedRef.current.state ? p.deliveryState : (data.uf ?? p.deliveryState ?? ""),
          deliveryComplement: editedRef.current.complement
            ? p.deliveryComplement
            : (data.complemento ?? p.deliveryComplement ?? ""),
        }));
      } catch {
        toast.error("Não foi possível consultar o CEP agora.");
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [formData.deliveryCep]);

  const validate = () => {
    if (!formData.customerName.trim()) return "Informe o nome completo.";
    if (!formData.customerPhone.trim()) return "Informe o telefone.";

    if (onlyDigits(formData.deliveryCep).length !== 8) return "Informe um CEP válido (8 dígitos).";
    if (!formData.deliveryStreet.trim()) return "Informe a rua.";
    if (!formData.deliveryNumber.trim()) return "Informe o número.";
    if (!formData.deliveryNeighborhood.trim()) return "Informe o bairro.";
    if (!formData.deliveryCity.trim()) return "Informe a cidade.";
    if (!formData.deliveryState.trim()) return "Informe o estado (UF).";

    if (!formData.selectedMachine.trim()) return "Selecione uma maquininha.";
    if (qty < 1 || qty > 1000) return "A quantidade deve estar entre 1 e 1000.";
    return null;
  };

  const buildDeliveryAddressString = () => {
    const cep = onlyDigits(formData.deliveryCep);
    const street = formData.deliveryStreet.trim();
    const number = formData.deliveryNumber.trim();
    const complement = formData.deliveryComplement.trim();
    const neighborhood = formData.deliveryNeighborhood.trim();
    const city = formData.deliveryCity.trim();
    const uf = formData.deliveryState.trim().toUpperCase();

    const line1 = `${street}, ${number}${complement ? ` - ${complement}` : ""}`;
    const line2 = `${neighborhood} - ${city}/${uf}`;
    return `${cep} - ${line1} • ${line2}`;
  };

  const onSubmit = async () => {
    const err = validate();
    if (err) {
      toast.error(err);
      return;
    }
    if (!selectedMachine) {
      toast.error("Maquininha inválida.");
      return;
    }

    const sendingId = toast.loading("Enviando pedido...");

    const unitPrice = getUnitPrice(selectedMachine, qty);
    const totalPrice = unitPrice * qty;
    const unitInstallment = getUnitInstallment(selectedMachine, qty);

    try {
      await createOrder({
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        customerEmail: formData.customerEmail.trim() ? formData.customerEmail.trim() : undefined,

        // mantém compatibilidade com seu schema atual
        deliveryAddress: buildDeliveryAddressString(),

        machineType: formData.machineType,
        selectedMachine: formData.selectedMachine,
        quantity: qty,

        paymentMethod: formData.paymentMethod,
        totalPrice,
        installmentPrice: unitInstallment, // parcela unitária
      });

      toast.success("Pedido enviado com sucesso.", { id: sendingId });

      editedRef.current = { street: false, complement: false, neighborhood: false, city: false, state: false };

      setFormData({
        customerName: "",
        customerPhone: "",
        customerEmail: "",

        deliveryCep: "",
        deliveryStreet: "",
        deliveryNumber: "",
        deliveryComplement: "",
        deliveryNeighborhood: "",
        deliveryCity: "",
        deliveryState: "",

        machineType: "subadquirente",
        selectedMachine: "",
        quantity: 1,
        paymentMethod: "avista",
      });
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar pedido.", { id: sendingId });
    }
  };

  // Card do modelo com layout desktop “imune” a quebra/overflow
  const MachineCard = ({ m }: { m: MachineOption }) => {
    const unit = getUnitPrice(m, qty);
    const total = unit * qty;
    const installments = m.installments ?? 12;
    const unitInst = getUnitInstallment(m, qty);

    return (
      <button
        type="button"
        onClick={() => setFormData((p) => ({ ...p, selectedMachine: m.name }))}
        className={[
          "w-full text-left rounded-2xl border p-4 transition",
          "bg-black/20 hover:bg-black/30",
          formData.selectedMachine === m.name
            ? "border-primary/60 ring-1 ring-primary/30"
            : "border-white/10",
        ].join(" ")}
      >
        {/*
          Layout do card pensado para não "repetir" valor (principalmente quando qty=1)
          e para manter alinhamento perfeito em qualquer largura.
        */}
        <div className="grid grid-cols-[1fr_auto] items-start gap-4">
          {/* Esquerda */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <span
                className={[
                  "inline-flex h-4 w-4 rounded-full border flex-shrink-0",
                  formData.selectedMachine === m.name
                    ? "border-primary bg-primary/60"
                    : "border-white/30 bg-transparent",
                ].join(" ")}
              />
              <div className="font-semibold truncate">{m.name}</div>
            </div>

            {unitInst != null && (
              <div className="mt-2 text-xs text-white/60 whitespace-nowrap tabular-nums">
                {installments}x de {formatBRL(unitInst)} sem juros
              </div>
            )}

            {/* Só mostra Total quando quantidade > 1, evitando o "valor 3x" quando qty=1 */}
            {qty > 1 && (
              <div className="mt-2 text-sm text-white/70 tabular-nums">
                Total ({qty} un.): <span className="text-white font-semibold">{formatBRL(total)}</span>
              </div>
            )}
          </div>

          {/* Direita: preço unitário destacado */}
          <div className="text-right flex-shrink-0">
            <div className="font-semibold whitespace-nowrap tabular-nums">{formatBRL(unit)}</div>
            <div className="text-xs text-white/60 whitespace-nowrap">Unitário</div>
          </div>
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* coluna principal */}
        <div className="xl:col-span-8 space-y-6">
          <SectionCard
            title="Dados do cliente e entrega"
            subtitle="Digite o CEP para auto-preenchimento. Você pode editar qualquer campo."
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-white/80 mb-2">
                  Nome completo <span className="text-red-400">*</span>
                </label>
                <input
                  value={formData.customerName}
                  onChange={(e) => setFormData((p) => ({ ...p, customerName: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="Nome e sobrenome"
                />
              </div>

              <div>
                <label className="block text-sm text-white/80 mb-2">
                  Telefone <span className="text-red-400">*</span>
                </label>
                <input
                  value={formData.customerPhone}
                  onChange={(e) => setFormData((p) => ({ ...p, customerPhone: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="(DDD) 9XXXX-XXXX"
                />
              </div>

              <div>
                <label className="block text-sm text-white/80 mb-2">E-mail</label>
                <input
                  value={formData.customerEmail}
                  onChange={(e) => setFormData((p) => ({ ...p, customerEmail: e.target.value }))}
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder="email@exemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm text-white/80 mb-2">
                  Quantidade <span className="text-red-400">*</span>
                </label>
                <input
                  type="number"
                  min={1}
                  max={1000}
                  value={formData.quantity}
                  onChange={(e) =>
                    setFormData((p) => ({ ...p, quantity: clampQty(Number(e.target.value)) }))
                  }
                  className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums"
                />
              </div>

              {/* Endereço em campos */}
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="md:col-span-1">
                  <label className="block text-sm text-white/80 mb-2">
                    CEP <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={formData.deliveryCep}
                    onChange={(e) => setFormData((p) => ({ ...p, deliveryCep: onlyDigits(e.target.value) }))}
                    inputMode="numeric"
                    maxLength={8}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums"
                    placeholder="00000000"
                  />
                  <div className="mt-1 text-xs text-white/50">8 dígitos para preencher.</div>
                </div>

                <div className="md:col-span-3">
                  <label className="block text-sm text-white/80 mb-2">
                    Rua <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={formData.deliveryStreet}
                    onChange={(e) => {
                      editedRef.current.street = true;
                      setFormData((p) => ({ ...p, deliveryStreet: e.target.value }));
                    }}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Rua / Avenida"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-white/80 mb-2">
                    Número <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={formData.deliveryNumber}
                    onChange={(e) => setFormData((p) => ({ ...p, deliveryNumber: e.target.value }))}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Ex: 123"
                  />
                </div>

                <div className="md:col-span-3">
                  <label className="block text-sm text-white/80 mb-2">Complemento</label>
                  <input
                    value={formData.deliveryComplement}
                    onChange={(e) => {
                      editedRef.current.complement = true;
                      setFormData((p) => ({ ...p, deliveryComplement: e.target.value }));
                    }}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Apto, bloco, referência"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm text-white/80 mb-2">
                    Bairro <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={formData.deliveryNeighborhood}
                    onChange={(e) => {
                      editedRef.current.neighborhood = true;
                      setFormData((p) => ({ ...p, deliveryNeighborhood: e.target.value }));
                    }}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Bairro"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-white/80 mb-2">
                    Cidade <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={formData.deliveryCity}
                    onChange={(e) => {
                      editedRef.current.city = true;
                      setFormData((p) => ({ ...p, deliveryCity: e.target.value }));
                    }}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                    placeholder="Cidade"
                  />
                </div>

                <div className="md:col-span-1">
                  <label className="block text-sm text-white/80 mb-2">
                    UF <span className="text-red-400">*</span>
                  </label>
                  <input
                    value={formData.deliveryState}
                    onChange={(e) => {
                      editedRef.current.state = true;
                      setFormData((p) => ({ ...p, deliveryState: e.target.value.toUpperCase().slice(0, 2) }));
                    }}
                    className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums"
                    placeholder="SP"
                    maxLength={2}
                  />
                </div>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Escolha do modelo"
            subtitle="Selecione PagSeguro ou Sub e escolha o equipamento. Valores e parcelamento aparecem sem quebrar."
          >
            <div className="flex flex-wrap items-center gap-5 mb-5">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={formData.machineType === "subadquirente"}
                  onChange={() =>
                    setFormData((p) => ({ ...p, machineType: "subadquirente", selectedMachine: "" }))
                  }
                />
                Sub
              </label>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={formData.machineType === "pagseguro"}
                  onChange={() =>
                    setFormData((p) => ({ ...p, machineType: "pagseguro", selectedMachine: "" }))
                  }
                />
                PagSeguro
              </label>

              <span className="text-xs text-white/50 tabular-nums">Quantidade: {qty}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {machines.map((m) => (
                <MachineCard key={m.name} m={m} />
              ))}
            </div>
          </SectionCard>
        </div>

        {/* resumo sticky */}
        <div className="xl:col-span-4 xl:sticky xl:top-24 space-y-6">
          <SectionCard title="Pagamento e resumo" subtitle="Revise o total antes de enviar.">
            <div className="flex flex-wrap gap-6 mb-4">
              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={formData.paymentMethod === "avista"}
                  onChange={() => setFormData((p) => ({ ...p, paymentMethod: "avista" }))}
                />
                À vista
              </label>

              <label className="inline-flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  checked={formData.paymentMethod === "parcelado"}
                  onChange={() => setFormData((p) => ({ ...p, paymentMethod: "parcelado" }))}
                />
                Parcelado (até 12x)
              </label>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-4 overflow-hidden">
              {!selectedMachine ? (
                <div className="text-sm text-white/60">Selecione um modelo para calcular o total.</div>
              ) : formData.paymentMethod === "avista" ? (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-4 min-w-0">
                    <span className="text-sm text-white/60 whitespace-nowrap flex-shrink-0">
                      Total à vista
                    </span>
                    <span className="min-w-0 text-right font-semibold text-green-500 tabular-nums whitespace-nowrap text-xl">
                      {formatBRL(totals.totalAvista)}
                    </span>
                  </div>
                  <div className="text-xs text-white/50 tabular-nums whitespace-nowrap">
                    {qty} un. • {selectedMachine.name}
                  </div>
                </div>
              ) : totals.unitInstallment != null ? (
                <div className="space-y-2">
                  <div className="flex items-baseline justify-between gap-4 min-w-0">
                    <span className="text-sm text-white/60 whitespace-nowrap flex-shrink-0">
                      {totals.installments}x sem juros
                    </span>
                    <span className="min-w-0 text-right font-semibold text-green-500 tabular-nums whitespace-nowrap text-xl">
                      {formatBRL(totals.totalInstallment ?? 0)}
                    </span>
                  </div>
                  <div className="text-xs text-white/50 tabular-nums whitespace-nowrap">
                    Parcela unitária: {formatBRL(totals.unitInstallment)} • {qty} un.
                  </div>
                </div>
              ) : (
                <div className="text-sm text-white/60">Sem informação de parcelamento para esta opção.</div>
              )}
            </div>

            <button
              onClick={onSubmit}
              className="mt-4 w-full rounded-2xl bg-primary px-4 py-3 font-semibold hover:opacity-90 transition"
            >
              Enviar pedido
            </button>

            <div className="mt-3 text-xs text-white/50">
              Ao enviar, você confirma que os dados estão corretos.
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
