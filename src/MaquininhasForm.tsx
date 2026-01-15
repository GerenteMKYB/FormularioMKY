import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";

type Tier = { min: number; max?: number; unitPrice: number };

type MachineOption = {
  name: string;
  price?: number; // à vista (unitário)
  installmentPrice?: number; // parcela unitária fixa, quando fornecida
  installments?: number; // default 12
  tiers?: Tier[]; // usado para S920
  allowAutoInstallment?: boolean; // se true, calcula parcela = unit/12 quando não tiver installmentPrice fixo
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

// ========================
// Catálogo (AJUSTADO)
// ========================
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
      { min: 100, unitPrice: 325.0 }, // 100+
    ],
    installments: 12,
    allowAutoInstallment: true, // como é “até 12x sem juros” sem valor fixo, parcela = unit/12
  },
];

export function MaquininhasForm() {
  const createOrder = useMutation(api.orders.createOrder);

  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",

    deliveryCep: "",
    deliveryAddress: "",

    machineType: "subadquirente" as "pagseguro" | "subadquirente",
    selectedMachine: "",
    quantity: 1,
    paymentMethod: "avista" as "avista" | "parcelado",
  });

  // Controle para não sobrescrever endereço editado pelo usuário
  const [addressEdited, setAddressEdited] = useState(false);
  const lastAutoFilledRef = useRef<string>("");

  const machines = useMemo(
    () => (formData.machineType === "pagseguro" ? pagSeguroMachines : subMachines),
    [formData.machineType],
  );

  const selectedMachine = useMemo(
    () => machines.find((m) => m.name === formData.selectedMachine),
    [machines, formData.selectedMachine],
  );

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

    const qty = clampQty(formData.quantity);
    const unitPrice = getUnitPrice(selectedMachine, qty);
    const totalAvista = unitPrice * qty;

    const installments = selectedMachine.installments ?? 12;
    const unitInstallment = getUnitInstallment(selectedMachine, qty);
    const totalInstallment = unitInstallment != null ? unitInstallment * qty : undefined;

    return { unitPrice, totalAvista, installments, unitInstallment, totalInstallment };
  }, [selectedMachine, formData.quantity]);

  // ========================
  // CEP -> ViaCEP (auto fill)
  // ========================
  useEffect(() => {
    const cepDigits = onlyDigits(formData.deliveryCep);

    // mantém o input “formatado” como somente números
    if (formData.deliveryCep !== cepDigits) {
      setFormData((p) => ({ ...p, deliveryCep: cepDigits }));
      return;
    }

    // só consulta quando tiver 8 dígitos
    if (cepDigits.length !== 8) return;

    let cancelled = false;

    const t = setTimeout(async () => {
      try {
        const res = await fetch(`https://viacep.com.br/ws/${cepDigits}/json/`, {
          method: "GET",
        });

        if (!res.ok) throw new Error("Falha ao consultar CEP.");
        const data = (await res.json()) as ViaCepResponse;

        if (data.erro) {
          toast.error("CEP não encontrado.");
          return;
        }

        const parts = [
          data.logradouro?.trim(),
          data.bairro?.trim(),
          data.localidade?.trim() ? `${data.localidade?.trim()}/${data.uf?.trim() ?? ""}` : undefined,
        ].filter(Boolean);

        const auto = parts.join(" - ").trim();
        if (!auto) return;

        if (cancelled) return;

        // Só auto-preenche se o usuário não tiver editado, OU se o campo ainda for o último auto-fill
        setFormData((p) => {
          const current = (p.deliveryAddress ?? "").trim();
          const lastAuto = (lastAutoFilledRef.current ?? "").trim();

          const canOverwrite = !addressEdited || current === lastAuto || current.length === 0;
          if (!canOverwrite) return p;

          lastAutoFilledRef.current = auto;
          return { ...p, deliveryAddress: auto };
        });

        // quando o CEP muda e o auto-fill roda, consideramos “não editado ainda”
        setAddressEdited(false);
      } catch {
        toast.error("Não foi possível consultar o CEP agora.");
      }
    }, 350); // debounce leve

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [formData.deliveryCep, addressEdited]);

  const renderMachineOptions = () => {
    const qty = clampQty(formData.quantity);

    return machines.map((machine) => {
      const unitPrice = getUnitPrice(machine, qty);
      const totalPrice = unitPrice * qty;

      const unitInstallment = getUnitInstallment(machine, qty);
      const installments = machine.installments ?? 12;

      return (
        <label
          key={machine.name}
          className={[
            "block p-4 border rounded-xl cursor-pointer transition",
            "bg-white/5 hover:bg-white/10",
            formData.selectedMachine === machine.name
              ? "border-primary ring-1 ring-primary/30"
              : "border-white/10",
          ].join(" ")}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <input
                type="radio"
                name="selectedMachine"
                value={machine.name}
                checked={formData.selectedMachine === machine.name}
                onChange={() => setFormData((prev) => ({ ...prev, selectedMachine: machine.name }))}
                className="mt-1"
              />

              <div className="min-w-0">
                <div className="font-semibold text-sm sm:text-base truncate">{machine.name}</div>
                <div className="text-xs sm:text-sm text-gray-400 whitespace-nowrap tabular-nums">
                  Unitário: {formatBRL(unitPrice)}
                </div>
                {unitInstallment != null && (
                  <div className="text-[11px] sm:text-xs text-gray-400 whitespace-nowrap tabular-nums">
                    {installments}x de {formatBRL(unitInstallment)} sem juros
                  </div>
                )}
              </div>
            </div>

            <div className="text-right flex-shrink-0">
              <div className="font-semibold whitespace-nowrap tabular-nums">
                {formatBRL(totalPrice)}
              </div>
              <div className="text-[11px] sm:text-xs text-gray-400 whitespace-nowrap tabular-nums">
                Total ({qty} un.)
              </div>
            </div>
          </div>
        </label>
      );
    });
  };

  const validate = () => {
    if (!formData.customerName.trim()) return "Informe o nome completo.";
    if (!formData.customerPhone.trim()) return "Informe o telefone.";
    if (onlyDigits(formData.deliveryCep).length !== 8) return "Informe um CEP válido (8 dígitos).";
    if (!formData.deliveryAddress.trim()) return "Informe o endereço de entrega.";
    if (!formData.selectedMachine.trim()) return "Selecione uma maquininha.";
    const q = clampQty(formData.quantity);
    if (q < 1 || q > 1000) return "A quantidade deve estar entre 1 e 1000.";
    return null;
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

    const qty = clampQty(formData.quantity);
    const unitPrice = getUnitPrice(selectedMachine, qty);
    const totalPrice = unitPrice * qty;

    const unitInstallment = getUnitInstallment(selectedMachine, qty);

    try {
      await createOrder({
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        customerEmail: formData.customerEmail.trim() ? formData.customerEmail.trim() : undefined,

        // guarda o endereço final editável; CEP fica apenas no front (se quiser salvar no banco, eu ajusto schema/mutation)
        deliveryAddress: `${onlyDigits(formData.deliveryCep)} - ${formData.deliveryAddress.trim()}`,

        machineType: formData.machineType,
        selectedMachine: formData.selectedMachine,
        quantity: qty,

        paymentMethod: formData.paymentMethod,
        totalPrice,
        installmentPrice: unitInstallment, // parcela unitária (fixa ou calculada)
      });

      toast.success("Pedido enviado com sucesso.", { id: sendingId });

      setFormData((prev) => ({
        ...prev,
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        deliveryCep: "",
        deliveryAddress: "",
        selectedMachine: "",
        quantity: 1,
        paymentMethod: "avista",
      }));
      setAddressEdited(false);
      lastAutoFilledRef.current = "";
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar pedido.", { id: sendingId });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Coluna Esquerda */}
      <div className="lg:col-span-4 bg-white/5 p-6 rounded-2xl shadow-sm border border-white/10">
        <h2 className="text-lg font-semibold mb-5">Dados do Cliente</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Nome Completo <span className="text-red-400">*</span>
            </label>
            <input
              value={formData.customerName}
              onChange={(e) => setFormData((p) => ({ ...p, customerName: e.target.value }))}
              className="w-full px-3 py-2 border border-white/10 bg-black/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Nome e sobrenome"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Telefone <span className="text-red-400">*</span>
            </label>
            <input
              value={formData.customerPhone}
              onChange={(e) => setFormData((p) => ({ ...p, customerPhone: e.target.value }))}
              className="w-full px-3 py-2 border border-white/10 bg-black/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="(DDD) 9XXXX-XXXX"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">E-mail</label>
            <input
              value={formData.customerEmail}
              onChange={(e) => setFormData((p) => ({ ...p, customerEmail: e.target.value }))}
              className="w-full px-3 py-2 border border-white/10 bg-black/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="email@exemplo.com"
            />
          </div>

          {/* CEP + Endereço */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <label className="block text-sm font-medium text-gray-200 mb-2">
                CEP <span className="text-red-400">*</span>
              </label>
              <input
                value={formData.deliveryCep}
                onChange={(e) => {
                  const digits = onlyDigits(e.target.value);
                  setFormData((p) => ({ ...p, deliveryCep: digits }));
                  // ao alterar CEP, permitimos auto-preencher novamente
                  setAddressEdited(false);
                }}
                inputMode="numeric"
                className="w-full px-3 py-2 border border-white/10 bg-black/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums"
                placeholder="00000000"
                maxLength={8}
              />
              <div className="text-xs text-gray-400 mt-1">
                Digite 8 dígitos para preencher.
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Endereço de entrega <span className="text-red-400">*</span>
              </label>
              <textarea
                value={formData.deliveryAddress}
                onChange={(e) => {
                  setFormData((p) => ({ ...p, deliveryAddress: e.target.value }));
                  setAddressEdited(true);
                }}
                className="w-full px-3 py-2 border border-white/10 bg-black/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[92px]"
                placeholder="Rua, número, complemento, bairro, cidade/UF"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">Tipo de maquininha</label>
            <div className="flex gap-6 items-center">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  value="subadquirente"
                  checked={formData.machineType === "subadquirente"}
                  onChange={() =>
                    setFormData((prev) => ({ ...prev, machineType: "subadquirente", selectedMachine: "" }))
                  }
                />
                Sub
              </label>

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  value="pagseguro"
                  checked={formData.machineType === "pagseguro"}
                  onChange={() =>
                    setFormData((prev) => ({ ...prev, machineType: "pagseguro", selectedMachine: "" }))
                  }
                />
                PagSeguro
              </label>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-200 mb-2">
              Quantidade <span className="text-red-400">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={1000}
              value={formData.quantity}
              onChange={(e) => setFormData((prev) => ({ ...prev, quantity: clampQty(Number(e.target.value)) }))}
              className="w-full px-3 py-2 border border-white/10 bg-black/20 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30 tabular-nums"
            />
          </div>
        </div>
      </div>

      {/* Coluna Direita */}
      <div className="lg:col-span-8 space-y-6">
        <div className="bg-white/5 p-6 rounded-2xl shadow-sm border border-white/10">
          <div className="flex items-center justify-between mb-4 gap-3">
            <h2 className="text-lg font-semibold">Selecione a Maquininha</h2>
            <div className="text-xs text-gray-400 whitespace-nowrap tabular-nums">
              Quantidade: {clampQty(formData.quantity)}
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{renderMachineOptions()}</div>
        </div>

        <div className="bg-white/5 p-6 rounded-2xl shadow-sm border border-white/10">
          <h2 className="text-lg font-semibold mb-4">Forma de Pagamento</h2>

          <div className="flex gap-6 mb-4 items-center">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                value="avista"
                checked={formData.paymentMethod === "avista"}
                onChange={() => setFormData((prev) => ({ ...prev, paymentMethod: "avista" }))}
              />
              À vista
            </label>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                value="parcelado"
                checked={formData.paymentMethod === "parcelado"}
                onChange={() => setFormData((prev) => ({ ...prev, paymentMethod: "parcelado" }))}
              />
              Parcelado (até 12x)
            </label>
          </div>

          {/* Total em destaque */}
          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
            {!selectedMachine ? (
              <div className="text-sm text-gray-400">
                Selecione uma maquininha para visualizar o total.
              </div>
            ) : formData.paymentMethod === "avista" ? (
              <div className="flex items-center justify-between gap-4">
                <div className="text-sm text-gray-400">Total à vista</div>
                <div className="text-xl font-semibold text-green-500 whitespace-nowrap tabular-nums">
                  {formatBRL(totals.totalAvista)}
                </div>
              </div>
            ) : totals.unitInstallment != null ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between gap-4">
                  <div className="text-sm text-gray-400">
                    {totals.installments}x sem juros
                  </div>
                  <div className="text-xl font-semibold text-green-500 whitespace-nowrap tabular-nums">
                    {formatBRL((totals.totalInstallment ?? 0))}
                  </div>
                </div>
                <div className="text-xs text-gray-500 tabular-nums">
                  Parcela unitária: {formatBRL(totals.unitInstallment)} • Quantidade: {clampQty(formData.quantity)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-400">
                Não há informação de parcelamento para esta opção.
              </div>
            )}
          </div>

          <button
            onClick={onSubmit}
            className="w-full bg-primary text-white py-3 rounded-xl font-semibold hover:opacity-90 transition mt-4"
          >
            Enviar pedido
          </button>
        </div>
      </div>
    </div>
  );
}
