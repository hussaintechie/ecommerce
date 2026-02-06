import pool from "../config/masterDB.js";
import { getTenantPool } from "../config/tenantDB.js";

export const CustomerModel = {

  getTenantDB: async (store_id) => {
    const db = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [store_id]
    );
    if (db.rows.length === 0) return null;
    return getTenantPool(db.rows[0].db_name);
  },

  // Insert Walk-in Customer (admin added)
  addCustomer: async ({ name, phone, email, store_id }) => {
    const result = await pool.query(
      `INSERT INTO tbl_login (name, phone, email, user_role,added_by, created_at)
       VALUES ($1, $2, $3, 'user','admin', NOW())
       RETURNING user_id`,
      [name, phone, email, store_id]
    );

    return result.rows[0].user_id;
  },

  // Get list of all customers (app + walkin)
 listCustomersFromLogin: async (store_id) => {
  return await pool.query(
    `SELECT user_id, phone, email, name, added_by, created_at
     FROM tbl_login
     WHERE register_id = $1
     ORDER BY user_id DESC`,
    [store_id]
  );
},
 


  // Get orders summary from tenant DB
  getCustomerOrderSummary: async (tenantPool, user_id) => {
  const res = await tenantPool.query(
    `SELECT 
        COUNT(*) AS total_orders,
        COALESCE(SUM(total_amount), 0) AS total_spent,
        MAX(created_at) AS last_order
     FROM tbl_master_orders
     WHERE user_id=$1`,
    [user_id]
  );
  return res.rows[0];
},

  getAppCustomerDetailsFromAddress: async (tenantPool, user_id) => {
  const res = await tenantPool.query(
    `SELECT name, city 
     FROM tbl_address 
     WHERE user_id=$1 
     ORDER BY created_at DESC 
     LIMIT 1`,
    [user_id]
  );
  return res.rows[0];
},


};
