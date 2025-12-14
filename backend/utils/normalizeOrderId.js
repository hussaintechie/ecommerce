export const normalizeOrderId = (order_id) => {
  if (typeof order_id === "number") return order_id;

  if (typeof order_id === "string") {
    const num = parseInt(order_id.replace(/\D/g, ""), 10);
    return isNaN(num) ? null : num;
  }

  return null;
};
