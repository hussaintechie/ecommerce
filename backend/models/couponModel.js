import pool from "../config/masterDB.js";
import { getTenantPool } from "../config/tenantDB.js";

export const CouponModel = {

  // 🔑 Resolve tenant DB (same as CustomerModel)
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

  // 🧾 Create coupon (ADMIN)
  createCoupon: async (tenantDB, data) => {
    return tenantDB.query(
      `
      INSERT INTO tbl_coupons
      (coupon_code, discount_type, discount_value, min_order_value, max_discount, expiry_date)
      VALUES ($1,$2,$3,$4,$5,$6)
      `,
      [
        data.coupon_code.toUpperCase(),
        data.discount_type,
        data.discount_value,
        data.min_order_value || 0,
        data.max_discount || null,
        data.expiry_date || null,
      ]
    );
  },

  // 📋 List coupons (ADMIN)
  // ✅ List coupons with usage info (per user)
getCoupons: async (tenantDB, user_id) => {
  return tenantDB.query(`
    SELECT 
      c.coupon_id,
      c.coupon_code,
      c.discount_type,
      c.discount_value,
      c.min_order_value,
      c.max_discount,
      c.expiry_date,
      c.is_active,
      CASE 
        WHEN cu.user_id IS NOT NULL THEN true
        ELSE false
      END AS is_used
    FROM tbl_coupons c
    LEFT JOIN tbl_coupon_usage cu 
      ON cu.coupon_id = c.coupon_id 
     AND cu.user_id = $1
    WHERE c.is_active = true
    ORDER BY c.created_at DESC
  `, [user_id]);
},


  // 🛒 Apply coupon (CART)
  applyCoupon: async (tenantDB, user_id, coupon_code, cartTotal) => {

    const couponRes = await tenantDB.query(
      `
      SELECT *
      FROM tbl_coupons
      WHERE coupon_code=$1
        AND is_active=true
        AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE)
      `,
      [coupon_code.toUpperCase()]
    );

    if (couponRes.rowCount === 0) {
      return { status: 0, message: "Invalid or expired coupon" };
    }

    const coupon = couponRes.rows[0];

    if (cartTotal < coupon.min_order_value) {
      return {
        status: 0,
        message: `Minimum order ₹${coupon.min_order_value} required`,
      };
    }

    const used = await tenantDB.query(
      `
      SELECT 1 FROM tbl_coupon_usage
      WHERE coupon_id=$1 AND user_id=$2
      `,
      [coupon.coupon_id, user_id]
    );

    if (used.rowCount > 0) {
      return { status: 0, message: "Coupon already used" };
    }

    let discount = 0;

    if (coupon.discount_type === "PERCENT") {
      discount = (cartTotal * coupon.discount_value) / 100;
      if (coupon.max_discount) {
        discount = Math.min(discount, coupon.max_discount);
      }
    } else {
      discount = coupon.discount_value;
    }

    return {
      status: 1,
      coupon_id: coupon.coupon_id,
      coupon_code: coupon.coupon_code,
      discount,
    };
  },

  // 🆕 First order ₹100
  getFirstOrderDiscount: async (tenantDB, user_id) => {
    const res = await tenantDB.query(
      `SELECT COUNT(*) FROM tbl_master_orders WHERE user_id=$1`,
      [user_id]
    );

    return Number(res.rows[0].count) === 0 ? 100 : 0;
  },

  // 🧾 Mark coupon used
  markCouponUsed: async (tenantDB, coupon_id, user_id, order_id) => {
    return tenantDB.query(
      `
      INSERT INTO tbl_coupon_usage (coupon_id, user_id, order_id)
      VALUES ($1,$2,$3)
      `,
      [coupon_id, user_id, order_id]
    );
  },
  deletecoupon: async (tenantDB, coupon_id) => {
    return tenantDB.query(
      ` DELETE FROM tbl_coupons WHERE coupon_id=$1 `,
      [coupon_id]
    );
  }

};


