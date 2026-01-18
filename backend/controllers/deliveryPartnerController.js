import deliveryPartnerModel from "../models/deliveryPartnerModel.js";
import pool from "../config/masterDB.js";
import { getTenantPool } from "../config/tenantDB.js";
import jwt from "jsonwebtoken";
import axios from "axios";
const sendSMS = async (phone, otp) => {
  console.log("FAST2SMS KEY (DELIVERY):", process.env.FAST2SMS_API_KEY);

  const mobile = phone.toString().replace(/\D/g, "");

  const response = await axios.post(
    "https://www.fast2sms.com/dev/bulkV2",
    {
      route: "dlt",
      sender_id: "BLJSTR",              // ✅ correct
      message: "206816",                // ✅ DLT MESSAGE ID (from panel)
      variables_values: otp.toString(), // matches {#var#}
      numbers: mobile,
    },
    {
      headers: {
        authorization: process.env.FAST2SMS_API_KEY,
        "Content-Type": "application/json",
      },
    }
  );

  console.log("FAST2SMS RESPONSE:", response.data);

  if (response.data?.return !== true) {
    throw new Error(response.data?.message || "OTP failed");
  }

  return true;
};
// ========================
// CREATE DELIVERY DRIVER
// ========================
export const createDriver = async (req, res) => {
  try {
    const register_id = req.user.register_id;

    const result = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id = $1",
      [register_id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    const response = await deliveryPartnerModel.createDriver(
      tenantDB,
      req.body,
      register_id // ✅ PASS IT
    );

    return res.json(response);
  } catch (err) {
    console.error("createDriver error:", err);
    return res.status(500).json({ status: 0, message: "Server error" });
  }
};


// ========================
// GET ALL DRIVERS
// ========================
export const getDrivers = async (req, res) => {
  try {
    const register_id = req.user.register_id;

    const result = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id = $1",
      [register_id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    const response = await deliveryPartnerModel.getDrivers(tenantDB);

    return res.json(response);
  } catch (err) {
    console.error("getDrivers error:", err);
    return res.status(500).json({ status: 0, message: "Server error" });
  }
};

// ========================
// GET DRIVER BY ID
// ========================
export const getDriverById = async (req, res) => {
  try {
    const register_id = req.user.register_id;

    const result = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id = $1",
      [register_id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    const response = await deliveryPartnerModel.getDriverById(
      tenantDB,
      req.params.id
    );

    return res.json(response);
  } catch (err) {
    console.error("getDriverById error:", err);
    return res.status(500).json({ status: 0, message: "Server error" });
  }
};

// ========================
// UPDATE DRIVER
// ========================
export const updateDriver = async (req, res) => {
  try {
    const register_id = req.user.register_id;

    const result = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id = $1",
      [register_id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    const response = await deliveryPartnerModel.updateDriver(
      tenantDB,
      req.params.id,
      req.body
    );

    return res.json(response);
  } catch (err) {
    console.error("updateDriver error:", err);
    return res.status(500).json({ status: 0, message: "Server error" });
  }
};

// ========================
// DELETE DRIVER
// ========================
export const deleteDriver = async (req, res) => {
  try {
    const register_id = req.user.register_id;

    const result = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id = $1",
      [register_id]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    const response = await deliveryPartnerModel.deleteDriver(
      tenantDB,
      req.params.id
    );

    return res.json(response);
  } catch (err) {
    console.error("deleteDriver error:", err);
    return res.status(500).json({ status: 0, message: "Server error" });
  }
};
export const deliveryPartnerLogin = async (req, res) => {
  try {
    const { mobile, register_id } = req.body;

    if (!mobile || !register_id) {
      return res.status(400).json({
        status: 0,
        message: "Mobile & register_id required",
      });
    }

    // 1️⃣ Get tenant DB (MASTER DB ONLY)
    const tenantRes = await pool.query(
      `SELECT db_name FROM tbl_tenant_databases WHERE register_id = $1`,
      [register_id]
    );

    if (!tenantRes.rows.length) {
      return res.status(404).json({
        status: 0,
        message: "Tenant not found",
      });
    }

    const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

    // 2️⃣ Validate driver (TENANT DB)
    const result = await deliveryPartnerModel.deliveryPartnerLogin(
      tenantDB,
      mobile
    );

    if (result.status === 0) {
      return res.status(401).json(result);
    }

    const driver = result.data;

    // 3️⃣ JWT
    const token = jwt.sign(
      {
        driver_id: driver.driver_id,
        register_id,
        role: "delivery_partner",
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    return res.json({
      status: 1,
      message: "Login successful",
      token,
      user: driver,
    });

  } catch (err) {
    console.error("Delivery login error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server error",
    });
  }
};

export const getLoggedInDriver = async (req, res) => {
  try {
    const { driver_id, register_id } = req.user;

    // 🔹 get tenant DB using register_id
    const tenantRes = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id = $1",
      [register_id]
    );

    if (!tenantRes.rows.length) {
      return res.status(404).json({
        status: 0,
        message: "Tenant not found",
      });
    }

    const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

    const result = await tenantDB.query(
      `SELECT full_name, mobile 
       FROM tbl_delivery_partner 
       WHERE driver_id = $1`,
      [driver_id]
    );

    return res.json({
      status: 1,
      data: result.rows[0],
    });
  } catch (err) {
    console.error("getLoggedInDriver error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server error",
    });
  }
};

// export const getDeliveryOrderDetails = async (req, res) => {
//   try {
//     const { orderId  } = req.params; // <-- from URL
//     const register_id = req.user.register_id;

//     if (!orderId) {
//       return res.status(400).json({
//         status: 0,
//         message: "Order ID required",
//       });
//     }

//     // 1️⃣ Get tenant DB
//     const tenantQuery = `
//       SELECT db_name 
//       FROM tbl_tenant_databases 
//       WHERE register_id = $1
//     `;
//     const tenantRes = await pool.query(tenantQuery, [register_id]);

//     if (!tenantRes.rows.length) {
//       return res.status(404).json({
//         status: 0,
//         message: "Store not found",
//       });
//     }

//     const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

//     // 2️⃣ MAIN QUERY (FIXED COLUMN NAME)
//     const query = `
//       SELECT 
//         o.order_id,
//         o.order_no,
//         a.name, 
//         a.phone,
//         a.address,
//         p.method
//       FROM tbl_master_orders o
//       JOIN tbl_address a ON a.user_id = o.user_id
//       JOIN tbl_master_payment p ON p.order_id = o.order_id
//       WHERE o.order_id = $1
//     `;

//     const result = await tenantDB.query(query, [orderId]);

//     if (!result.rows.length) {
//       return res.status(404).json({
//         status: 0,
//         message: "Order not found",
//       });
//     }

//     return res.status(200).json({
//   status: 1,
//   data: {
//     order_id: result.rows[0].order_id,   // ✅ REQUIRED
//     order_code: result.rows[0].order_no,
//     customer_name: result.rows[0].name,
//     phone: result.rows[0].phone,
//     address: result.rows[0].address,
//     method: result.rows[0].method,
//   },
// });

//   } catch (error) {
//     console.error("Delivery fetch error:", error);
//     return res.status(500).json({
//       status: 0,
//       message: "Server error",
//     });
//   }
// };



export const getDeliveryOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params; // order_code
    const register_id = req.user.register_id;

    const tenantRes = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id = $1",
      [register_id]
    );

    const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

    const result = await tenantDB.query(
      `
      SELECT 
        o.order_id,
        o.order_no,
        a.name,
        a.phone,
        a.address,
        p.method
      FROM tbl_master_orders o
      JOIN tbl_address a ON a.user_id = o.user_id
      JOIN tbl_master_payment p ON p.order_id = o.order_id
      WHERE o.order_no = $1
      `,
      [orderId] // ORD0115 ✅
    );

    if (!result.rows.length) {
      return res.status(404).json({ status: 0, message: "Order not found" });
    }

    return res.json({ status: 1, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 0, message: "Server error" });
  }
};
export const sendDeliveryOTP = async (req, res) => {
  try {
    const { order_id } = req.body;
    const register_id = req.user.register_id;

    const tenantRes = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [register_id]
    );

    const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

    const order = await tenantDB.query(
      `SELECT a.phone 
       FROM tbl_master_orders o
       JOIN tbl_address a ON a.user_id = o.user_id
       WHERE o.order_id = $1`,
      [order_id]
    );

    if (!order.rows.length)
      return res.status(404).json({ status: 0, message:"Order not found" });

    const otp = Math.floor(1000 + Math.random() * 9000);

    await tenantDB.query(
      `UPDATE tbl_master_orders SET delivery_otp=$1 WHERE order_id=$2`,
      [otp, order_id]
    );

    await sendSMS(order.rows[0].phone, otp);

    res.json({ status: 1, message: "OTP sent to customer" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 0, message: "OTP failed" });
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

    // 🔹 Get tenant DB
    const tenantRes = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [register_id]
    );

    if (!tenantRes.rows.length) {
      return res.status(404).json({
        status: 0,
        message: "Tenant not found",
      });
    }

    const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

    // 🔹 Get OTP + payment method
    const result = await tenantDB.query(
      `
      SELECT 
        o.delivery_otp,
        COALESCE(p.method, 'COD') AS method
      FROM tbl_master_orders o
      LEFT JOIN tbl_master_payment p 
        ON p.order_id = o.order_id
      WHERE o.order_id = $1
      `,
      [order_id]
    );

    if (!result.rows.length) {
      return res.json({ status: 0, message: "Order not found" });
    }

    const { delivery_otp, method } = result.rows[0];

    // 🔐 OTP validation (string-safe)
    if (!delivery_otp || delivery_otp.toString() !== otp.toString()) {
      return res.json({ status: 0, message: "Invalid OTP" });
    }

    // 🔹 Update ORDER table
    await tenantDB.query(
      `
      UPDATE tbl_master_orders
      SET 
        order_status = 'delivered',
        payment_status = 'complete',
        delivery_otp = NULL
      WHERE order_id = $1
      `,
      [order_id]
    );

    // 🔹 If COD → mark payment complete
    if (method.toLowerCase() === "cod") {
      await tenantDB.query(
        `
        UPDATE tbl_master_payment
        SET status = 'complete'
        WHERE order_id = $1
        `,
        [order_id]
      );
    }

    return res.json({
      status: 1,
      message: "Delivery completed successfully",
    });

  } catch (err) {
    console.error("Verify Delivery OTP Error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message ,
    });
  }
};
