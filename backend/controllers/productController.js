import pool from "../config/masterDB.js";
import XLSX from "xlsx";
import { getTenantPool } from "../config/tenantDB.js";
import productmodel from "../models/productModel.js";
import crypto from "crypto";
import { io } from "../server.js";
// -----------------------------
// Razorpay Signature Validation
// -----------------------------
function isValidRazorpaySignature(orderId, paymentId, signature) {
  const body = `${orderId}|${paymentId}`;

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(body)
    .digest("hex");

  return expected === signature;
}



export const orderdatas = async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.body;
    const register_id = req.user.register_id;

    if (!register_id) {
      return res.status(400).json({
        status: 0,
        message: "Store ID required",
      });
    }

    // 🔹 GET TENANT DB NAME
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;
    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Store not found",
      });
    }

    // 🔹 GET TENANT DB CONNECTION
    const tenantDB = getTenantPool(result.rows[0].db_name);

    // 🔹 CALL MODEL
    const response = await productmodel.orderdataget(
      tenantDB,
      register_id,
      limit,
      offset
    );

    return res.status(200).json(response);

  } catch (error) {
    console.error("orderdatas error:", error);
    return res.status(500).json({
      status: 0,
      message: "Order fetch failed",
      error: error.message,
    });
  }
};



export const submitorder = async (req, res) => {
  let tenantDB;

  try {
    const {
      address_delivery,
      total_amount,
      handling_fee,
      delivery_fee,
      order_status,
      delivery_id,
      payment_status,
      payment_method,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      items_details,
      delivery_start,   // ✅ already local string
      delivery_end
    } = req.body;

    if (!delivery_start) {
      return res.json({ status: 0, message: "Delivery time required" });
    }

    const register_id = req.user.register_id;
    const user_id = req.user.user_id;

    const t = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [register_id]
    );

    tenantDB = getTenantPool(t.rows[0].db_name);
    if (delivery_start == "Immediate") {
  return res.status(400).json({
    status: 0,
    message: "Delivery end time missing",
  });
}

    const orderdatares = await productmodel.ordersubmit(
      tenantDB,
      user_id,
      address_delivery,
      total_amount,
      handling_fee,
      delivery_fee,
      delivery_start,   // ✅ STORE AS-IS
      delivery_end,
      order_status,
      delivery_id,
      payment_status,
      payment_method,          // ✅
  razorpay_payment_id,     // ✅
  razorpay_order_id,       // ✅
  razorpay_signature,  
      items_details,
       req.body.coupon_code,
  req.body.coupon_discount,
  req.body.first_order_discount,
  req.body.coupon_id
    );

// 🔔 REAL-TIME NOTIFICATION

    if (!orderdatares || orderdatares.status !== 1) {
      return res.status(500).json({ status: 0, message: "Order creation failed" });
    }
   io.emit("new-order", {
  order_id: orderdatares.order_id,
  register_id,
  total_amount
});

    return res.status(200).json({
      status: 1,
      message: "Order submitted successfully",
      order_id: orderdatares.order_id,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 0, message: "Server Error" });
  }
};



export const allcatedetails = async (req, res) => {
  // {
  //   "register_id": 1,
  //   "mode_fetchorall": 0,
  //   "cate_id": 0
  // }

  try {
    const { mode_fetchorall, cate_id } = req.body;
    const register_id = req.user.register_id;

    if (!register_id) {
      return res.status(400).json({
        status: 0,
        message: "Store ID required",
      });
    }

    // Get Customer DB name (tenant)
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;

    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    // Call model function
    const catedatares = await productmodel.allcatedetails(
      tenantDB,
      register_id,
      mode_fetchorall,
      cate_id
    );

    return res.status(200).json(catedatares);
  } catch (err) {
    console.error("Category data get Error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server Error",
      error: err.message,
    });
  }
};

export const getuserorders = async (req, res) => {
  // {
  //   "register_id": 1,
  //   "userid": 3
  // }
  try {
    const userid = req.user.user_id;
    const register_id = req.user.register_id;

    if (!register_id) {
      return res.status(400).json({
        status: 0,
        message: "Store ID required",
      });
    }
    if (!userid) {
      return res.status(400).json({
        status: 0,
        message: "User ID required",
      });
    }

    // Get Customer DB name (tenant)
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;

    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    // Call model function
    const userorderres = await productmodel.getuserorders(
      tenantDB,
      register_id,
      userid
    );

    return res.status(200).json(userorderres);
  } catch (err) {
    console.error("user order data get Error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server Error",
      error: err.message,
    });
  }
};
export const singleorddetail = async (req, res) => {
  // {
  //   "register_id": 1,
  //   "orderid": 3
  // }
  try {
    const { orderid } = req.body;
    
    const register_id = req.user.register_id;
    if (!register_id) {
      return res.status(400).json({
        status: 0,
        message: "Store ID required",
      });
    }
    if (!orderid) {
      return res.status(400).json({
        status: 0,
        message: "Order ID required",
      });
    }

    // Get Customer DB name (tenant)
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;

    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    // Call model function
    const userorderres = await productmodel.singleorddetail(
      tenantDB,
      register_id,
      orderid
    );

    return res.status(200).json(userorderres);
  } catch (err) {
    console.error("order data get Error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server Error",
      error: err.message,
    });
  }
};
export const markOutForDelivery = async (req, res) => {
  try {
    const { order_id } = req.body;
    const register_id = req.user.register_id;

    if (!order_id) {
      return res.status(400).json({
        status: 0,
        message: "Order ID required",
      });
    }

    // 🔹 GET TENANT DB
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;
    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Store not found",
      });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    // 🔹 CALL MODEL
    const response = await productmodel.markOutForDelivery(tenantDB, order_id);

    return res.status(200).json(response);
  } catch (err) {
    console.error("markOutForDelivery error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server error",
      error: err.message,
    });
  }
};

export const verifyDeliveryOTP = async (req, res) => {
  try {
    const { order_id, otp } = req.body;
    const register_id = req.user.register_id;

    if (!order_id || !otp) {
      return res.status(400).json({
        status: 0,
        message: "Order ID and OTP required",
      });
    }

    // 🔹 GET TENANT DB
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;
    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Store not found",
      });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    // 🔹 CALL MODEL
    const response = await productmodel.verifyDeliveryOTP(
      tenantDB,
      order_id,
      otp
    );

    return res.status(200).json(response);
  } catch (err) {
    console.error("verifyDeliveryOTP error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server error",
      error: err.message,
    });
  }
};

export const trackOrder = async (req, res) => {
  try {
    const { order_id } = req.body;
    const register_id = req.user.register_id;

    if (!order_id) {
      return res.status(400).json({
        status: 0,
        message: "Order ID required",
      });
    }

    // 🔹 GET TENANT DB
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;
    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Store not found",
      });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    // 🔹 CALL MODEL
    const response = await productmodel.trackOrder(tenantDB, order_id);

    return res.status(200).json(response);
  } catch (err) {
    console.error("trackOrder error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server error",
      error: err.message,
    });
  }
};
export const getDeliveryOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const register_id = req.user.register_id;

    if (!orderId) {
      return res.status(400).json({ status: 0, message: "Order ID required" });
    }

    const tenantRes = await pool.query(
      `SELECT db_name FROM tbl_tenant_databases WHERE register_id = $1`,
      [register_id]
    );

    if (!tenantRes.rowCount) {
      return res.status(404).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

    const query = `
      SELECT 
        o.order_id,
        a.name,
        a.phone,
        a.full_address
      FROM tbl_master_orders o
      JOIN tbl_address a ON a.user_id = o.user_id
      WHERE o.user_id = $1
    `;

    const result = await tenantDB.query(query, [orderId]);

    if (!result.rowCount) {
      return res.status(404).json({ status: 0, message: "Order not found" });
    }

    return res.json({ status: 1, data: result.rows[0] });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 0, message: "Server error" });
  }
};

