import pool from "../config/masterDB.js";
import { getTenantPool } from "../config/tenantDB.js";

export const CustomerModel = {

  // 🔑 Resolve tenant DB
  getTenantDB: async (register_id) => {
    const dbRes = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [register_id]
    );

    if (dbRes.rowCount === 0) {
      throw new Error("Invalid tenant");
    }

    return getTenantPool(dbRes.rows[0].db_name);
  },

  // 👥 Get all customers (TENANT DATA)
  getCustomers: async (tenantDB, search = "", limit = 10, offset = 0) => {

    /* ---------------- DATA QUERY (UNCHANGED) ---------------- */
    const dataQuery = `
      SELECT 
        u.user_id AS id,
        u.name,
        u.phone,
        u.full_address,
        COALESCE(COUNT(o.order_id), 0) AS total_orders,
        MAX(o.created_at) AS last_order
      FROM tbl_address u
      LEFT JOIN tbl_master_orders o 
        ON o.user_id = u.user_id
      WHERE u.name ILIKE $1
      GROUP BY 
        u.user_id,
        u.name,
        u.phone,
        u.full_address
      ORDER BY u.user_id DESC
      LIMIT $2 OFFSET $3
    `;

    const customersRes = await tenantDB.query(dataQuery, [
      `%${search}%`,
      limit,
      offset,
    ]);

    /* ---------------- TOTAL USER COUNT (MASTER DB) ---------------- */
    const countQuery = `
      SELECT COUNT(*) 
      FROM tbl_login
      WHERE user_role = 'user'
    `;

    const totalRes = await pool.query(countQuery);

    return {
      rows: customersRes.rows,                 // tenant customers
      total: parseInt(totalRes.rows[0].count), // ✅ ONLY USERS
    };
  },

  // 📦 Get orders of a user
  getUserOrders: async (tenantDB, user_id) => {
    return tenantDB.query(
      `
      SELECT 
        o.order_id,
        o.order_no,
        o.total_amount,
        p.method,
        o.order_status,
        t.created_at,
        COALESCE(SUM(oi.product_qty), 0) AS items
      FROM tbl_master_orders o
      INNER JOIN tbl_master_payment p 
        ON p.order_id = o.order_id
      INNER JOIN tbl_order_tracking t
        ON t.order_id = o.order_id
      LEFT JOIN tbl_master_order_items oi
        ON oi.order_id = o.order_id
      WHERE o.user_id = $1
      GROUP BY 
        o.order_id,
        o.order_no,
        o.total_amount,
        p.method,
        o.order_status,
        t.created_at
      ORDER BY t.created_at DESC
      `,
      [user_id]
    );
  }

};
