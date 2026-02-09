import { getTenantPool } from "../config/tenantDB.js";
import pool from "../config/masterDB.js";

export const CartModel = {
  getTenantDB: async (store_id) => {
    const db = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [store_id]
    );

    if (db.rows.length === 0) throw new Error("Invalid store");

    return getTenantPool(db.rows[0].db_name);
  },

  // CHECK IF ITEM EXISTS
  checkCartItem: async (db, user_id, product_id) => {
    const query = `
      SELECT * FROM tbl_cart 
      WHERE user_id = $1 AND product_id = $2 AND status = 'active'
    `;
    return await db.query(query, [user_id, product_id]);
  },

  // ADD NEW ITEM TO CART
  addToCart: async (db, user_id, product_id, quantity) => {
    const query = `
      INSERT INTO tbl_cart (user_id, product_id, quantity)
      VALUES ($1, $2, $3)
    `;
    return await db.query(query, [user_id, product_id, quantity]);
  },

  // UPDATE QUANTITY
  updateQuantity: async (db, cart_id, quantity) => {
    const query = `
      UPDATE tbl_cart 
      SET quantity = quantity + $1
      WHERE cart_id = $2
    `;
    return await db.query(query, [quantity, cart_id]);
  },

  // SET SPECIFIC QUANTITY
  setQuantity: async (db, cart_id, quantity) => {
    const query = `
      UPDATE tbl_cart 
      SET quantity = $1
      WHERE cart_id = $2
    `;
    return await db.query(query, [quantity, cart_id]);
  },

  // REMOVE CART ITEM
  removeItem: async (db, cart_id) => {
    const query = `
      UPDATE tbl_cart SET status = 'removed'
      WHERE cart_id = $1
    `;
    return await db.query(query, [cart_id]);
  },

  // CLEAR USER CART
  clearCart: async (db, user_id) => {
    const query = `
      UPDATE tbl_cart SET status = 'removed'
      WHERE user_id = $1 AND status = 'active'
    `;
    return await db.query(query, [user_id]);
  },

  // GET USER CART
  listCart: async (db, user_id) => {
    const query = `
      SELECT c.*,  p.title AS product_name,  p.thumbnail, p.price
      FROM tbl_cart c
      LEFT JOIN tbl_master_product p ON p.product_id = c.product_id
      WHERE c.user_id = $1 AND c.status = 'active'
      ORDER BY c.created_at DESC
    `;
    return await db.query(query, [user_id]);
  },
};
