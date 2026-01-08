import pool from "../config/masterDB.js";
import { getTenantPool } from "../config/tenantDB.js";

export const DashboardModel = {

  // 🔹 Get tenant DB from store_id
  getTenantDB: async (store_id) => {
    const db = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id = $1",
      [store_id]
    );
   
    if (db.rows.length === 0) return null;

    return getTenantPool(db.rows[0].db_name);
  },

  // 🔹 Dashboard Stats
  dashboardStats: async (store_id) => {
    try {
      const tenantDB = await DashboardModel.getTenantDB(store_id);
      if (!tenantDB) throw new Error("Invalid store");

      const totalOrders = await tenantDB.query(`
        SELECT COUNT(*) FROM tbl_master_orders
      `);

      const revenue = await tenantDB.query(`
        SELECT COALESCE(SUM(total_amount), 0) AS total
        FROM tbl_master_orders
        WHERE payment_status = 'SUCCESS'
      `);

      const pending = await tenantDB.query(`
        SELECT COUNT(*) FROM tbl_master_orders
        WHERE order_status IN ('Pending', 'Process')
      `);

      const graph = await tenantDB.query(`
        SELECT 
          TO_CHAR(created_at, 'DD Mon') AS label,
          SUM(total_amount) AS value
        FROM tbl_master_orders
        WHERE created_at >= NOW() - INTERVAL '7 days'
        GROUP BY label
        ORDER BY MIN(created_at)
      `);

      const recentOrders = await tenantDB.query(`
        SELECT 
          o.order_id,
          o.order_no,
          o.total_amount,
          o.order_status,
          u.name AS customer,
          COUNT(i.product_id) AS items
        FROM tbl_master_orders o
        LEFT JOIN tbl_master_order_items i ON i.order_id = o.order_id
        LEFT JOIN tbl_address u ON u.user_id = o.user_id
        GROUP BY o.order_id, u.name
        ORDER BY o.created_at DESC
        LIMIT 5
      `);

      return {
        totalOrders: Number(totalOrders.rows[0].count),
        totalRevenue: Number(revenue.rows[0].total),
        pendingOrders: Number(pending.rows[0].count),
        revenueGraph: graph.rows,
        recentOrders: recentOrders.rows,
      };

    } catch (error) {
      console.error("Dashboard model error:", error);
      throw error;
    }
  }
};

