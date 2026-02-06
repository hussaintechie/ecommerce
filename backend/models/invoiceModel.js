import pool from "../config/masterDB.js";
import { getTenantPool } from "../config/tenantDB.js";

export const InvoiceModel = {

  // 🔑 Resolve tenant DB
  getTenantDB: async (register_id) => {
    const db = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [register_id]
    );

    if (db.rows.length === 0) return null;

    const tenantDB = getTenantPool(db.rows[0].db_name);

    console.log("USING TENANT DB:", tenantDB.options.database);

    return tenantDB;
  },

  // 📦 Fetch invoice data
  getInvoiceData: async (tenantDB, orderId) => {

    // 🧾 Order + customer
    const orderRes = await tenantDB.query(
      `SELECT 
         o.order_id,
         o.order_no,
         o.total_amount,
         o.created_at,
         COALESCE(a.name, 'N/A') AS customer_name,
         COALESCE(a.phone, 'N/A') AS phone,
         COALESCE(a.full_address, 'N/A') AS full_address
       FROM public.tbl_master_orders o
       LEFT JOIN public.tbl_address a 
         ON o.user_id = a.user_id
       WHERE o.order_id = $1::int`,
      [orderId]
    );

    if (orderRes.rows.length === 0) return null;

    // 📦 Order items
    const itemsRes = await tenantDB.query(
      `SELECT 
         product_name,
         product_qty,
         product_amount
       FROM public.tbl_master_order_items
       WHERE order_id = $1::int`,
      [orderId]
    );

    return {
      order: orderRes.rows[0],
      items: itemsRes.rows,
    };
  }
};
