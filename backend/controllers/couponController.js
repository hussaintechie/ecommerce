import { CouponModel } from "../models/couponModel.js";

/* ================= ADMIN ================= */

// ➕ Create coupon
export const createCoupon = async (req, res) => {
  try {
    const { coupon_code, discount_type, discount_value } = req.body;

    if (!coupon_code || !discount_type || !discount_value) {
      return res.status(400).json({
        status: 0,
        message: "Coupon code, type and value are required",
      });
    }

    if (!["PERCENT", "FLAT"].includes(discount_type)) {
      return res.status(400).json({
        status: 0,
        message: "Invalid discount type",
      });
    }

    const tenantDB = await CouponModel.getTenantDB(req.user.register_id);
    await CouponModel.createCoupon(tenantDB, req.body);

    return res.json({
      status: 1,
      message: "Coupon created successfully",
    });

  } catch (err) {
    if (err.code === "23505") {
      return res.status(400).json({
        status: 0,
        message: "Coupon code already exists",
      });
    }

    console.error("Create coupon error:", err);
    return res.status(500).json({ status: 0, message: err.message });
  }
};

// 📋 List coupons
export const getCoupons = async (req, res) => {
  try {
    const tenantDB = await CouponModel.getTenantDB(req.user?.register_id || req.body.register_id);

    const result = await CouponModel.getCoupons(
      tenantDB,
      req.user.user_id
    );

    return res.json({
      status: 1,
      data: result.rows
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 0, message: err.message });
  }
};

/* ================= CART ================= */

// 🛒 Apply coupon
// 🛒 Apply coupon
export const applyCoupon = async (req, res) => {
  try {
    const { coupon_code, cart_total } = req.body;

    if (!coupon_code || cart_total == null) {
      return res.status(400).json({
        status: 0,
        message: "Coupon code and cart total are required",
      });
    }

    const tenantDB = await CouponModel.getTenantDB(req.user.register_id);

    // 1️⃣ Apply coupon (validation + raw discount)
    const couponRes = await CouponModel.applyCoupon(
      tenantDB,
      req.user.user_id,
      coupon_code,
      cart_total
    );

    if (couponRes.status === 0) {
      return res.json(couponRes);
    }

    // 2️⃣ First order discount (₹100 or 0)
    let firstOrderDiscount =
      await CouponModel.getFirstOrderDiscount(
        tenantDB,
        req.user.user_id
      );

    // 🔒 3️⃣ CAP FIRST ORDER DISCOUNT
    // If cart total is ₹60 → discount becomes ₹60 (not 100)
    firstOrderDiscount = Math.min(firstOrderDiscount, cart_total);

    // 4️⃣ Remaining amount after first order discount
    const remainingAfterFirst =
      cart_total - firstOrderDiscount;

    // 🔒 5️⃣ CAP COUPON DISCOUNT
    const couponDiscount = Math.min(
      couponRes.discount,
      remainingAfterFirst
    );

    // 6️⃣ Final payable (never negative)
    const toPay = Math.max(
      cart_total - firstOrderDiscount - couponDiscount,
      0
    );

    return res.json({
      status: 1,

      coupon: {
        coupon_id: couponRes.coupon_id,
        coupon_code: couponRes.coupon_code,
        discount: couponDiscount,
      },

      first_order_discount: firstOrderDiscount,
      cart_total,
      to_pay: toPay,
    });

  } catch (err) {
    console.error("Apply coupon error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};
// controllers/couponController.js

// ❌ Delete coupon (ADMIN)
export const deletecoupon = async (req, res) => {
  try {
    const { coupon_id } = req.params;

    if (!coupon_id) {
      return res.status(400).json({
        status: 0,
        message: "Coupon ID required",
      });
    }

    const tenantDB = await CouponModel.getTenantDB(req.user.register_id);

    await CouponModel.deletecoupon(tenantDB, coupon_id);

    return res.json({
      status: 1,
      message: "Coupon deleted successfully",
    });

  } catch (err) {
    console.error("Delete coupon error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};
