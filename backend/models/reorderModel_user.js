import pool from "../config/masterDB.js";
import { getTenantPool } from "../config/tenantDB.js";

export const OrderModel = {
  getTenantDB: async (register_id) => {
    const db = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [register_id]
    );
    if (db.rows.length === 0) throw new Error("Invalid store");
    return getTenantPool(db.rows[0].db_name);
  },

 getOrderById: async (db, order_no, user_id) => {
  const res = await db.query(
    `SELECT * FROM tbl_master_orders
     WHERE order_no = $1 AND user_id = $2`,
    [order_no, user_id]
  );
  return res.rows[0];
},


  getOrderItems: async (db, order_id) => {
    const res = await db.query(
      `SELECT product_id, product_qty
       FROM tbl_master_order_items
       WHERE order_id=$1`,
      [order_id]
    );
    return res.rows;
  },

  // IMPORTANT: NO STOCK LOGIC HERE
  getActiveProduct: async (db, product_id) => {
    const res = await db.query(
      `SELECT product_id
       FROM tbl_master_product
       WHERE product_id=$1`,
      [product_id]
    );
    return res.rows[0];
  },
};
