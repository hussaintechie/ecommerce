import { OrderModel } from "../models/reorderModel_user.js";
import { CartModel } from "../models/cartModel_user.js";
import { normalizeOrderId } from "../utils/normalizeOrderId.js";

export const reorder = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const register_id = req.user.register_id;

    const rawOrderId = req.body.order_id;
    const order_id = normalizeOrderId(rawOrderId);

    if (!order_id) {
      return res.status(400).json({
        status: 0,
        message: "Invalid order reference",
      });
    }

    const tenantDB = await OrderModel.getTenantDB(register_id);

    // 1️⃣ Verify order belongs to user
    const order = await OrderModel.getOrderById(
      tenantDB,
      order_id,
      user_id
    );

    if (!order) {
      return res.status(404).json({
        status: 0,
        message: "Order not found",
      });
    }

    // 2️⃣ Get order items
    const items = await OrderModel.getOrderItems(tenantDB, order_id);

    let added = 0;
    let skipped = 0;

    for (const item of items) {
      // 3️⃣ Product existence check ONLY
      const product = await OrderModel.getActiveProduct(
        tenantDB,
        item.product_id
      );

      if (!product) {
        skipped++;
        continue;
      }

      // 4️⃣ Check cart
      const cartRes = await CartModel.checkCartItem(
        tenantDB,
        user_id,
        item.product_id
      );

      if (cartRes.rowCount > 0) {
        // ✅ RESET quantity (NOT ADD)
        await CartModel.setQuantity(
          tenantDB,
          cartRes.rows[0].cart_id,
          item.product_qty
        );
      } else {
        await CartModel.addToCart(
          tenantDB,
          user_id,
          item.product_id,
          item.product_qty
        );
      }

      added++;
    }

    return res.json({
      status: 1,
      message: "Reorder completed",
      added,
      skipped,
    });

  } catch (err) {
    console.error("Reorder error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};
