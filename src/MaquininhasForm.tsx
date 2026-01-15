import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { toast } from "sonner";

type MachineOption = {
  name: string;
  price: number;
  installmentPrice?: number;
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

export function MaquininhasForm() {
  const createOrder = useMutation(api.orders.createOrder);

  const [formData, setFormData] = useState({
    customerName: "",
    customerPhone: "",
    customerEmail: "",

    machineType: "subadquirente" as "pagseguro" | "subadquirente",
    selectedMachine: "",
    quantity: 1,
    paymentMethod: "avista" as "avista" | "parcelado",
  });

  const renderMachineOptions = () => {
    const machines =
      formData.machineType === "pagseguro" ? pagSeguroMachines : subadquirenteMachines;

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
                onChange={() =>
                  setFormData((prev) => ({ ...prev, selectedMachine: machine.name }))
                }
              />
              <div>
                <div className="font-medium">{machine.name}</div>
                <div className="text-sm text-gray-600">
                  Unitário:{" "}
                  {machine.price.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </div>
              </div>
            </div>

            <div className="text-right">
              <div className="font-semibold">
                {totalPrice.toLocaleString("pt-BR", {
                  style: "currency",
                  currency: "BRL",
                })}
              </div>
              {machine.installmentPrice && (
                <div className="text-xs text-gray-500">
                  Parcela:{" "}
                  {machine.installmentPrice.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
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

    const machines =
      formData.machineType === "pagseguro" ? pagSeguroMachines : subadquirenteMachines;

    const selected = machines.find((m) => m.name === formData.selectedMachine);
    if (!selected) {
      toast.error("Maquininha inválida.");
      return;
    }

    const totalPrice = selected.price * formData.quantity;

    try {
      await createOrder({
        customerName: formData.customerName.trim(),
        customerPhone: formData.customerPhone.trim(),
        customerEmail: formData.customerEmail.trim() ? formData.customerEmail.trim() : undefined,

        machineType: formData.machineType,
        selectedMachine: formData.selectedMachine,
        quantity: formData.quantity,

        paymentMethod: formData.paymentMethod,
        totalPrice,
        installmentPrice: selected.installmentPrice,
      });

      toast.success("Pedido enviado com sucesso.");

      setFormData((prev) => ({
        ...prev,
        customerName: "",
        customerPhone: "",
        customerEmail: "",
        selectedMachine: "",
        quantity: 1,
        paymentMethod: "avista",
      }));
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao enviar pedido.");
    }
  };

  return (
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
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Telefone <span className="text-red-500">*</span>
          </label>
          <input
            value={formData.customerPhone}
            onChange={(e) => setFormData((p) => ({ ...p, customerPhone: e.target.value }))}
            placeholder="(11) 99999-9999"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email (opcional)
          </label>
          <input
            value={formData.customerEmail}
            onChange={(e) => setFormData((p) => ({ ...p, customerEmail: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h2 className="text-xl font-semibold mb-4">Tipo de Máquina</h2>

          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="pagseguro"
                checked={formData.machineType === "pagseguro"}
                onChange={() =>
                  setFormData((prev) => ({
                    ...prev,
                    machineType: "pagseguro",
                    selectedMachine: "",
                  }))
                }
              />
              PagSeguro
            </label>

            <label className="flex items-center gap-2">
              <input
                type="radio"
                value="subadquirente"
                checked={formData.machineType === "subadquirente"}
                onChange={() =>
                  setFormData((prev) => ({
                    ...prev,
                    machineType: "subadquirente",
                    selectedMachine: "",
                  }))
                }
              />
              Subadquirente
            </label>
          </div>

          <div className="mb-4">
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
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="mt-1 text-xs text-gray-500">Máximo: 100 unidades por pedido.</p>
          </div>

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
                onChange={() =>
                  setFormData((prev) => ({ ...prev, paymentMethod: "parcelado" }))
                }
              />
              Parcelado
            </label>
          </div>
        </div>

        <button
          onClick={onSubmit}
          className="w-full bg-primary text-white py-3 rounded-lg font-medium hover:opacity-90 transition"
        >
          Enviar pedido
        </button>
      </div>
    </div>
  );
}
