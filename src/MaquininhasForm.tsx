import { useMemo, useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";

type MachineOption = {
  name: string;
  price: number; // à vista (unitário)
  installmentPrice?: number; // valor da parcela (unitário), quando aplicável
  installments?: number; // número de parcelas (default 12 quando houver installmentPrice)
};

const pagSeguroMachines: MachineOption[] = [
  { name: "Minizinha Chip", price: 47.88 },
  { name: "Moderninha Pro", price: 107.88 },
  { name: "POS A960", price: 525 },
];

const subadquirenteMachines: MachineOption[] = [
  { name: "Smart", price: 196.08 },
  { name: "Pro", price: 399.9 },
];

const formatBRL = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
    () => (formData.machineType === "pagseguro" ? pagSeguroMachines : subadquirenteMachines),
    [formData.machineType],
  );

  const selectedMachine = useMemo(
    () => machines.find((m) => m.name === formData.selectedMachine),
    [machines, formData.selectedMachine],
  );

  const totals = useMemo(() => {
    const unitPrice = selectedMachine?.price ?? 0;
    const totalAvista = unitPrice * formData.quantity;

    const installments = selectedMachine?.installments ?? 12;
    const unitInstallment = selectedMachine?.installmentPrice;
    const totalInstallment = unitInstallment != null ? unitInstallment * formData.quantity : undefined;

    return { unitPrice, totalAvista, installments, unitInstallment, totalInstallment };
  }, [selectedMachine, formData.quantity]);

  const renderMachineOptions = () => {
    return machines.map((machine) => {
      const totalPrice = machine.price * formData.quantity;

      return (
        <label
          key={machine.name}
          className={`block p-4 border rounded-lg cursor-pointer transition ${
            formData.selectedMachine === machine.name
              ? "border-primary bg-primary/5"
              : "border-gray-200 hover:border-gray-300"
          }`}
        >
          <div className="flex items-center justify-between">
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
                <div className="text-sm text-gray-600">Unitário: {formatBRL(machine.price)}</div>
              </div>
            </div>

            <div className="text-right">
              <div className="font-semibold">{formatBRL(totalPrice)}</div>
              {machine.installmentPrice != null && (
                <div className="text-xs text-gray-500">Parcela: {formatBRL(machine.installmentPrice)}</div>
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
    if (!Number.isFinite(formData.quantity) || formData.quantity < 1 || formData.quantity > 100) {
      return "A quantidade deve estar entre 1 e 100.";
    }
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

    // Toast imediato ao clique (confirmação de ação)
    const sendingId = toast.loading("Enviando pedido...");

    const totalPrice = selectedMachine.price * formData.quantity;

    try {
      await createOrder({
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        customerEmail: formData.customerEmail.trim() ? formData.customerEmail.trim() : undefined,
        deliveryAddress: formData.deliveryAddress.trim(),

        machineType: formData.machineType,
        selectedMachine: formData.selectedMachine,
        quantity: formData.quantity,

        paymentMethod: formData.paymentMethod,
        totalPrice,
        installmentPrice: selectedMachine.installmentPrice,
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
                Subadquirente
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
              max={100}
              value={formData.quantity}
              onChange={(e) => {
                const n = Number(e.target.value);
                const safe = Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 1;
                setFormData((prev) => ({ ...prev, quantity: safe }));
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
              Parcelado
            </label>
          </div>

          {/* Total em tempo real (verde) */}
          <div className="rounded-lg border border-gray-200 p-4">
            {!selectedMachine ? (
              <div className="text-sm text-gray-600">Selecione uma maquininha para visualizar o total.</div>
            ) : formData.paymentMethod === "avista" ? (
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-600">Total à vista</div>
                <div className="text-lg font-semibold text-green-600">{formatBRL(totals.totalAvista)}</div>
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
                  Parcela unitária: {formatBRL(totals.unitInstallment)} • Quantidade: {formData.quantity}
                </div>
              </div>
            ) : (
              <div className="text-sm text-gray-600">
                Esta maquininha não possui valor parcelado cadastrado. Selecione “À vista” ou cadastre o valor de
                parcela.
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
