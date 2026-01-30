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

  checkCartItem: async (db, user_id, product_id) => {
    const query = `
      SELECT * FROM tbl_cart 
      WHERE user_id = $1 AND product_id = $2 AND status = 'active'
    `;
    return await db.query(query, [user_id, product_id]);
  },

  addToCart: async (db, user_id, product_id, quantity) => {
    const query = `
      INSERT INTO tbl_cart (user_id, product_id, quantity)
      VALUES ($1, $2, $3)
    `;
    return await db.query(query, [user_id, product_id, quantity]);
  },

  // ✅ UPDATE QUANTITY (+1 / -1)
  updateQuantity: async (db, cart_id, changeQty) => {
    // changeQty will be +1 or -1
    const query = `
      UPDATE tbl_cart
      SET quantity = quantity + $1
      WHERE cart_id = $2
      RETURNING quantity
    `;
    const result = await db.query(query, [changeQty, cart_id]);

    // ✅ if quantity becomes 0 or negative => remove
    const newQty = result.rows[0]?.quantity ?? 0;
    if (newQty <= 0) {
      await db.query(
        `UPDATE tbl_cart SET status='removed', quantity=0 WHERE cart_id=$1`,
        [cart_id]
      );
    }

    return result;
  },

  // ✅ SET SPECIFIC QUANTITY (used for cart screen)
  setQuantity: async (db, cart_id, quantity) => {
    // ✅ if user set qty 0 => remove item
    if (quantity <= 0) {
      return await db.query(
        `UPDATE tbl_cart 
         SET status='removed', quantity=0 
         WHERE cart_id=$1`,
        [cart_id]
      );
    }

    const query = `
      UPDATE tbl_cart 
      SET quantity = $1
      WHERE cart_id = $2
    `;
    return await db.query(query, [quantity, cart_id]);
  },

  removeItem: async (db, cart_id) => {
    const query = `
      UPDATE tbl_cart SET status = 'removed', quantity=0
      WHERE cart_id = $1
    `;
    return await db.query(query, [cart_id]);
  },

  clearCart: async (db, user_id) => {
    const query = `
      UPDATE tbl_cart SET status = 'removed', quantity=0
      WHERE user_id = $1 AND status = 'active'
    `;
    return await db.query(query, [user_id]);
  },

  // ✅ show only qty > 0
  listCart: async (db, user_id) => {
    const query = `
      SELECT c.*, p.title AS product_name, p.thumbnail, p.price
      FROM tbl_cart c
      LEFT JOIN tbl_master_product p ON p.product_id = c.product_id
      WHERE c.user_id = $1 
        AND c.status = 'active'
        AND c.quantity > 0
      ORDER BY c.created_at DESC
    `;
    return await db.query(query, [user_id]);
  },
};
