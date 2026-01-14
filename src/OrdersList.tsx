import { useQuery, useMutation } from "convex/react";
import { api } from "../convex/_generated/api";
import { Id } from "../convex/_generated/dataModel";

export function OrdersList() {
  const orders = useQuery(api.orders.listOrders);
  const updateOrderStatus = useMutation(api.orders.updateOrderStatus);

  const formatMoney = (value: number) =>
    value.toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  if (!orders) {
    return (
      <div className="flex justify-center items-center py-8">
        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const handleStatusChange = async (orderId: Id<"orders">, status: string) => {
    await updateOrderStatus({
      orderId,
      status: status as "pending" | "sent" | "completed" | "cancelled",
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "sent":
        return "bg-blue-100 text-blue-800";
      case "completed":
        return "bg-green-100 text-green-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "pending":
        return "Pendente";
      case "sent":
        return "Enviado";
      case "completed":
        return "Concluído";
      case "cancelled":
        return "Cancelado";
      default:
        return status;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md">
      {orders.length === 0 ? (
        <div className="p-6 text-center text-gray-500">Nenhum pedido encontrado</div>
      ) : (
        <div className="divide-y divide-gray-200">
          {orders.slice(0, 10).map((order) => (
            <div key={order._id} className="p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h4 className="font-semibold text-gray-800">{order.customerName}</h4>
                  <p className="text-sm text-gray-600">{order.customerPhone}</p>
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                    order.status
                  )}`}
                >
                  {getStatusText(order.status)}
                </span>
              </div>

              <div className="text-sm text-gray-600 mb-2">
                <p>
                  <strong>Máquina:</strong> {order.selectedMachine} ({order.machineType})
                </p>
                <p>
                  <strong>Quantidade:</strong> {order.quantity}
                </p>
                <p>
                  <strong>Pagamento:</strong> {order.paymentMethod === "avista" ? "À vista" : "Parcelado"}
                </p>
                <p>
                  <strong>Total:</strong> R$ {formatMoney(order.totalPrice)}
                </p>
                {order.installmentPrice && (
                  <p>
                    <strong>Parcela:</strong> 12x R$ {formatMoney(order.installmentPrice)}
                  </p>
                )}
              </div>

              <div className="flex space-x-2">
                <select
                  value={order.status}
                  onChange={(e) => handleStatusChange(order._id, e.target.value)}
                  className="text-xs px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                >
                  <option value="pending">Pendente</option>
                  <option value="sent">Enviado</option>
                  <option value="completed">Concluído</option>
                  <option value="cancelled">Cancelado</option>
                </select>
              </div>

              <div className="text-xs text-gray-400 mt-2">
                {new Date(order._creationTime).toLocaleString("pt-BR")}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
