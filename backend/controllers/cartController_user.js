import { CartModel } from "../models/cartModel_user.js";
export const addToCart = async (req, res) => {
  try {
    const { product_id, quantity } = req.body;
    const user_id = req.user.user_id;
    const store_id = req.user.register_id;

    if (!user_id || !product_id || !store_id) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const tenantDB = await CartModel.getTenantDB(store_id);

    const exists = await CartModel.checkCartItem(tenantDB, user_id, product_id);

    if (exists.rowCount > 0) {
      await CartModel.updateQuantity(
        tenantDB,
        exists.rows[0].cart_id,
        quantity || 1
      );

      return res.json({ message: "Cart updated", status: true });
    }

    await CartModel.addToCart(tenantDB, user_id, product_id, quantity || 1);

    return res.json({ message: "Added to cart", status: true });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const getCart = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const store_id = req.user.register_id;

    const tenantDB = await CartModel.getTenantDB(store_id);

    const data = await CartModel.listCart(tenantDB, user_id);

    return res.json({ status: 1, cart: data.rows });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const updateCartQuantity = async (req, res) => {
  try {
    const { cart_id, quantity } = req.body;
    const store_id = req.user.register_id;

    if (!cart_id || !quantity) {
      return res.status(400).json({ message: "Missing fields" });
    }

    const tenantDB = await CartModel.getTenantDB(store_id);

    await CartModel.setQuantity(tenantDB, cart_id, quantity);

    return res.json({
      status: 1,
      message: "Quantity updated",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const removeCartItem = async (req, res) => {
  try {
    const { cart_id } = req.body;
    const store_id = req.user.register_id;

    const tenantDB = await CartModel.getTenantDB(store_id);

    await CartModel.removeItem(tenantDB, cart_id);

    return res.json({
      status: 1,
      message: "Item removed",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const clearCart = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const store_id = req.user.register_id;

    const tenantDB = await CartModel.getTenantDB(store_id);

    await CartModel.clearCart(tenantDB, user_id);

    return res.json({
      status: 1,
      message: "Cart cleared",
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const getCartBill = async (req, res) => {
  try {
    const user_id = req.user.user_id;
    const store_id = req.user.register_id;

    const tenantDB = await CartModel.getTenantDB(store_id);

    // 1. Get cart items
    const data = await CartModel.listCart(tenantDB, user_id);
    const cartItems = data.rows;

    if (cartItems.length === 0) {
      return res.json({
        status: 1,
        bill: {
          item_total: 0,
          handling_fee: 0,
          delivery_fee: 0,
          minimum_order: 200,
          remaining_amount: 200,
          to_pay: 0,
        },
      });
    }

    // 2. Calculate totals
    const item_total = cartItems.reduce((sum, item) => {
      return sum + item.price * item.quantity;
    }, 0);

    const handling_fee = 5; // like zepto
    const delivery_fee = item_total >= 200 ? 0 : "FREE"; // You can change logic

    const MIN_ORDER = 200;

    const remaining_amount =
      item_total >= MIN_ORDER ? 0 : MIN_ORDER - item_total;

    const to_pay = item_total + handling_fee + (delivery_fee === 0 ? 0 : 0);

    return res.json({
      status: 1,
      bill: {
        item_total,
        handling_fee,
        delivery_fee,
        minimum_order: MIN_ORDER,
        remaining_amount,
        to_pay,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const getDeliverySlots = async (req, res) => {
  try {
    const now = new Date();
    const todaySlots = [];
    const tomorrowSlots = [];

    const formatTime = (date) =>
      date.toLocaleTimeString("en-IN", {
        hour: "numeric",
        minute: "2-digit",
      });

    // -------------------------
    // 1️⃣ Generate TODAY slots
    // -------------------------
    let hour = now.getHours() + 1; // next available hour

    for (let i = 0; i < 6; i++) {
      let start = new Date();
      start.setHours(hour + i, 30, 0);

      let end = new Date();
      end.setHours(hour + i + 1, 30, 0);

      // end after 10:30 PM max
      if (start.getHours() >= 22) break;

      todaySlots.push({
        label: `Today, ${formatTime(start)} - ${formatTime(end)}`,
        start,
        end,
      });
    }

    // -------------------------
    // 2️⃣ Generate TOMORROW slots (fixed pattern)
    // -------------------------
    const base = new Date();
    base.setDate(base.getDate() + 1);

    for (let i = 10; i <= 19; i++) {
      let start = new Date(base);
      start.setHours(i, 30, 0);

      let end = new Date(base);
      end.setHours(i + 1, 30, 0);

      tomorrowSlots.push({
        label: `Tomorrow, ${formatTime(start)} - ${formatTime(end)}`,
        start,
        end,
      });
    }

    // -------------------------
    // 3️⃣ Decide final output (Option B logic)
    // -------------------------
    if (todaySlots.length === 0) {
      return res.json({
        status: 1,
        today: [],
        tomorrow: tomorrowSlots,
        message: "No delivery slots available today. Select from tomorrow.",
      });
    }

    return res.json({
      status: 1,
      today: todaySlots,
      tomorrow: tomorrowSlots,
      message: null,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
