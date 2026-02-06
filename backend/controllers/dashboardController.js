import { DashboardModel } from "../models/dashboardModel.js";

export const getDashboardStats = async (req, res) => {
  try {
    const store_id = req.user.register_id;
 // from JWT / middleware

    const data = await DashboardModel.dashboardStats(store_id);

    res.json({
      status: 1,
      data
    });
  } catch (error) {
    console.error("Dashboard controller error:", error);
    res.status(500).json({
      status: 0,
      message: "Dashboard fetch failed"
    });
  }
};

