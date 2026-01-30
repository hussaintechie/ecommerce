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
    const store_id = req.user?.register_id || req.body.register_id;

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
    const store_id = req.user?.register_id || req.body.store_id;

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
          to_pay: 0,
        },
      });
    }

    // 2. Calculate item total
    const item_total = cartItems.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );

    // 🔥 NEW BILLING RULES
    const HANDLING_FEE = 0;
    const FREE_DELIVERY_LIMIT = 0;

    const delivery_fee = item_total < FREE_DELIVERY_LIMIT ? 0 : 0;

    const to_pay = item_total + HANDLING_FEE + delivery_fee;

    return res.json({
      status: 1,
      bill: {
        item_total,
        handling_fee: HANDLING_FEE,
        delivery_fee,
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



const nowHour = now.getHours();
const nowMin = now.getMinutes();

// Start time = next available 30-min block
let start = new Date();
if (nowMin <= 30) {
  start.setHours(nowHour, 30, 0);
} else {
  start.setHours(nowHour + 1, 0, 0);
}

// Last allowed end time = 8:30 PM
const lastSlotEnd = new Date();
lastSlotEnd.setHours(20, 30, 0);

// Loop until end time exceeds 8:30 PM
while (start < lastSlotEnd) {
  const end = new Date(start);
  end.setHours(start.getHours() + 1);

  // stop if end time goes beyond 8:30 PM
  if (end > lastSlotEnd) break;

  todaySlots.push({
    label: `Today, ${formatTime(start)} - ${formatTime(end)}`,
    start,
    end,
  });

  // move to next 1-hour slot
  start = new Date(end);
}

    // -------------------------
    // 2️⃣ Generate TOMORROW slots (fixed pattern)
    // -------------------------
    const base = new Date();
    base.setDate(base.getDate() + 1);

    for (let i = 10; i <= 19; i++) {
      let start = new Date(base);
      
      start.setHours(i, 0, 0);

      let end = new Date(base);
      end.setHours(i + 1, 0, 0);

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
