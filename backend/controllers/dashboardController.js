import ProductModel from "../models/productModel.js";

export const getDashboard = async (req, res) => {
  try {
    const register_id = req.user.register_id;
    const { period } = req.query; // week | month | year

    const tenantDB = await ProductModel.getTenantDB(register_id);

    const result = await ProductModel.dashboardStats(
      tenantDB,
      period || "month"
    );

    return res.json(result);
  } catch (error) {
    console.error("Dashboard API error:", error);
    return res.status(500).json({
      status: 0,
      message: "Dashboard API failed",
    });
  }
};
