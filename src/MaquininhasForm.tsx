import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";

type Tier = { min: number; max?: number; unitPrice: number };

type MachineOption = {
  name: string;

  // Preço unitário fixo (à vista)
  price?: number;

  // Parcela unitária fixa (quando fornecida pelo negócio)
  installmentPrice?: number;

  // Se não vier, assume 12 quando houver parcelado
  installments?: number;

  // Preço escalonado por quantidade (unitário) — usado para S920
  tiers?: Tier[];

  // Se true e não houver installmentPrice fixo, calcula parcela = total/12
  allowAutoInstallment?: boolean;
};

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
  {
    name: "Smart",
    price: 196.08,
    installmentPrice: 16.34,
    installments: 12,
  },
  {
    name: "Moderninha Pro",
    price: 107.88,
    installmentPrice: 8.99,
    installments: 12,
  },
  {
    name: "Minizinha Chip",
    price: 47.88,
    installmentPrice: 3.99,
    installments: 12,
  },
];

const subMachines: MachineOption[] = [
  {
    name: "POS A960",
    price: 826.0,
    installmentPrice: 69.0,
    installments: 12,
  },
  {
    name: "S920",
    tiers: [
      { min: 1, max: 10, unitPrice: 525.0 },
      { min: 11, max: 19, unitPrice: 475.0 },
      { min: 20, max: 49, unitPrice: 425.0 },
      { min: 50, max: 99, unitPrice: 375.0 },
      { min: 100, unitPrice: 325.0 }, // 100+ (interpretei “+100” como 100 ou mais)
    ],
    installments: 12,
    allowAutoInstallment: true, // parcela = total/12 (já que o valor exato não foi informado)
  },
];

export function MaquininhasForm() {
  const createOrder = useMutation(api.orders.createOrder);

  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",
    deliveryAddress: "",

    machineType: "subadquirente" as "pagseguro" | "subadquirente",
    selectedMachine: "",
    quantity: 1,
    paymentMethod: "avista" as "avista" | "parcelado",
  });

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
    const totalInstallment =
      unitInstallment != null ? unitInstallment * qty : undefined;

    return { unitPrice, totalAvista, installments, unitInstallment, totalInstallment };
  }, [selectedMachine, formData.quantity]);

  const renderMachineOptions = () => {
    const qty = clampQty(formData.quantity);

    return machines.map((machine) => {
      const unitPrice = getUnitPrice(machine, qty);
      const totalPrice = unitPrice * qty;

      const unitInstallment = getUnitInstallment(machine, qty);
      const installments = machine.installments ?? 12;
      const totalInstallment =
        unitInstallment != null ? unitInstallment * qty : undefined;

      return (
        <label
          key={machine.name}
          className={`block p-4 border rounded-lg cursor-pointer transition ${
            formData.selectedMachine === machine.name
              ? "border-primary bg-primary/5"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <input
                type="radio"
                name="selectedMachine"
                value={machine.name}
                checked={formData.selectedMachine === machine.name}
                onChange={() => setFormData((prev) => ({ ...prev, selectedMachine: machine.name }))}
              />
              <div>
                <div className="font-medium">{machine.name}</div>
                <div className="text-sm text-gray-600">
                  Unitário: {formatBRL(unitPrice)}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="font-semibold">{formatBRL(totalPrice)}</div>

              {unitInstallment != null && (
                <div className="text-xs text-gray-500">
                  {installments}x de {formatBRL(totalInstallment ?? 0)} (total das parcelas)
                </div>
              )}
            </div>
          </div>
        </label>
      );
    });
  };

  const validate = () => {
    if (!formData.customerName.trim()) return "Informe o nome completo.";
    if (!formData.customerPhone.trim()) return "Informe o telefone.";
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
        customerEmail: formData.customerEmail.trim()
          ? formData.customerEmail.trim()
          : undefined,
        deliveryAddress: formData.deliveryAddress.trim(),

        machineType: formData.machineType,
        selectedMachine: formData.selectedMachine,
        quantity: qty,

        paymentMethod: formData.paymentMethod,
        totalPrice,
        // Mantém como “parcela unitária” no banco (como já estava no seu fluxo)
        installmentPrice: unitInstallment,
      });

      toast.success("Pedido enviado com sucesso.", { id: sendingId });

      setFormData((prev) => ({
        ...prev,
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        deliveryAddress: "",
        selectedMachine: "",
        quantity: 1,
        paymentMethod: "avista",
      }));
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar pedido.", { id: sendingId });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white p-6 rounded-lg shadow-sm border">
        <h2 className="text-xl font-semibold mb-4">Dados do Cliente</h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Nome Completo <span className="text-red-500">*</span>
            </label>
            <input
              value={formData.customerName}
              onChange={(e) => setFormData((p) => ({ ...p, customerName: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Nome e sobrenome"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Telefone <span className="text-red-500">*</span>
            </label>
            <input
              value={formData.customerPhone}
              onChange={(e) => setFormData((p) => ({ ...p, customerPhone: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="(DDD) 9XXXX-XXXX"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">E-mail</label>
            <input
              value={formData.customerEmail}
              onChange={(e) => setFormData((p) => ({ ...p, customerEmail: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="email@exemplo.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Endereço de entrega <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.deliveryAddress}
              onChange={(e) => setFormData((p) => ({ ...p, deliveryAddress: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[96px]"
              placeholder="Rua, número, complemento, bairro, cidade/UF, CEP"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de maquininha</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
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

              <label className="flex items-center gap-2">
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

          <div className="mb-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Quantidade de maquininhas <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min={1}
              max={1000}
              value={formData.quantity}
              onChange={(e) => {
                const n = Number(e.target.value);
                setFormData((prev) => ({ ...prev, quantity: clampQty(n) }));
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">Selecione a Maquininha</h2>
          <div className="space-y-3">{renderMachineOptions()}</div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">Forma de Pagamento</h2>

          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="avista"
                checked={formData.paymentMethod === "avista"}
                onChange={() => setFormData((prev) => ({ ...prev, paymentMethod: "avista" }))}
              />
              À vista
            </label>

            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="parcelado"
                checked={formData.paymentMethod === "parcelado"}
                onChange={() => setFormData((prev) => ({ ...prev, paymentMethod: "parcelado" }))}
              />
              Parcelado (até 12x)
            </label>
          </div>

          <div className="rounded-lg border border-gray-200 p-4">
            {!selectedMachine ? (
              <div className="text-sm text-gray-600">Selecione uma maquininha para visualizar o total.</div>
            ) : formData.paymentMethod === "avista" ? (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">Total à vista</div>
                <div className="text-lg font-semibold text-green-600">
                  {formatBRL(totals.totalAvista)}
                </div>
              </div>
            ) : totals.unitInstallment != null ? (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Parcelado ({totals.installments}x) • Parcela total
                  </div>
                  <div className="text-lg font-semibold text-green-600">
                    {formatBRL(totals.totalInstallment ?? 0)}
                  </div>
                </div>
                <div className="text-xs text-gray-500">
                  Parcela unitária: {formatBRL(totals.unitInstallment)} • Quantidade: {clampQty(formData.quantity)}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                Não há valor de parcela disponível para esta opção.
              </div>
            )}
          </div>

          <button
            onClick={onSubmit}
            className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:opacity-90 transition mt-4"
          >
            Enviar pedido
          </button>
        </div>
      </div>
    </div>
  );
}
