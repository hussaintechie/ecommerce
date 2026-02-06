import { CustomerModel } from "../models/userModel.js";

export const getCustomers = async (req, res) => {
  try {
    const register_id = req.user.register_id;

    // ✅ read pagination & search
    const { page = 1, limit = 10, search = "" } = req.query;
    const offset = (page - 1) * limit;

    const tenantDB = await CustomerModel.getTenantDB(register_id);

    // ✅ paginated model call
    const result = await CustomerModel.getCustomers(
      tenantDB,
      search,
      parseInt(limit),
      offset
    );

    // ✅ map DB → UI fields
    const customers = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      full_address: row.full_address,
      totalOrders: Number(row.total_orders),
      lastOrder: row.last_order
        ? new Date(row.last_order).toISOString().split("T")[0]
        : "—"
    }));


    return res.json({
      status: 1,
      data: customers,
      total: result.total, // 🔥 REQUIRED for pagination
    });

  } catch (err) {
    console.error("Get customers error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};




export const getUserOrders = async (req, res) => {
  try {
    const register_id = req.user.register_id;
    const { userid } = req.body;

    if (!userid) {
      return res.status(400).json({
        status: 0,
        message: "User ID required",
      });
    }

    // 🔑 Resolve tenant DB
    const tenantDB = await CustomerModel.getTenantDB(register_id);

    // 📦 Fetch orders
    const ordersRes = await CustomerModel.getUserOrders(
      tenantDB,
      userid
    );

    return res.json({
      status: 1,
      data: ordersRes.rows,
    });

  } catch (err) {
    console.error("Get user orders error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};