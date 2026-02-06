import pool from "../config/masterDB.js";
import { getTenantPool } from "../config/tenantDB.js";
import fs from "fs";
import path from "path";
import axios from "axios";
import { generateToken } from "../helpers/jwt.js";

// ==========================================
// ADMIN REGISTRATION (Production Ready)
// ==========================================
export const adminRegister = async (req, res) => {
  try {
    const { phone, store_name, email_id } = req.body;

    if (!phone || !store_name)
      return res.status(400).json({ message: "Phone & store name required" });

    // Check admin exists
    const exists = await pool.query(
      "SELECT * FROM tbl_register WHERE phone=$1",
      [phone]
    );

    if (exists.rows.length > 0)
      return res.status(400).json({ message: "Admin already exists" });

    // Insert admin
    const reg = await pool.query(
      `INSERT INTO tbl_register (phone, store_name, email_id)
       VALUES ($1,$2,$3) RETURNING register_id`,
      [phone, store_name, email_id || null]
    );

    const register_id = reg.rows[0].register_id;

    // Create login row
    await pool.query(
      `INSERT INTO tbl_login (phone, user_role, register_id) VALUES ($1,$2,$3)`,
      [phone, "admin", register_id]
    );

    // Create tenant DB
    const dbName = store_name.toLowerCase().replace(/\s+/g, "_");
    await pool.query(`CREATE DATABASE ${dbName}`);

    // Save mapping
    await pool.query(
      `INSERT INTO tbl_tenant_databases (register_id, db_name, db_user, db_pass, port)
       VALUES ($1,$2,$3,$4,$5)`,
      [
        register_id,
        dbName,
        process.env.DB_USER,
        process.env.DB_PASS,
        process.env.DB_PORT,
      ]
    );

    // Run schema
    const tenantPool = getTenantPool(dbName);
    const schema = fs.readFileSync(path.join("tenant", "tenantSchema.sql")).toString();
    await tenantPool.query(schema);

    res.json({
      status: 1,
      message: "Admin registered + Tenant DB created",
      register_id,
      dbName,
    });

  } catch (err) {
    console.error("Admin Register Error:", err);
    res.status(500).json({ message: "Registration failed" });
  }
};

// ==========================================
// LOGIN WITH PHONE + OTP
// ==========================================

//Generate OTP
const generateOTP = () =>
  Math.floor(100000 + Math.random() * 900000);

const sendSMS = async (phone, otp) => {
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
export const login = async (req, res) => {
  try {
    const { phone, otp, sendOtp } = req.body;

    if (!phone) {
      return res.status(400).json({
        status: 0,
        message: "Phone required",
      });
    }

    /* ================= SEND OTP ================= */
    if (sendOtp) {
      const newOtp = generateOTP();
      const expiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

      const userCheck = await pool.query(
        "SELECT user_id, register_id FROM tbl_login WHERE phone=$1",
        [phone]
      );

      let finalRegisterId;

      if (userCheck.rows.length > 0) {
        // ✅ Existing user → update OTP
        finalRegisterId = userCheck.rows[0].register_id;

        await pool.query(
          `UPDATE tbl_login 
           SET otp=$1, otp_expiry=$2 
           WHERE phone=$3`,
          [newOtp, expiry, phone]
        );
      } else {
        // ✅ New user → assign default store
        const store = await pool.query(
          `SELECT register_id 
           FROM tbl_register 
           WHERE is_default=true 
           LIMIT 1`
        );

        if (!store.rows.length) {
          return res.status(400).json({
            status: 0,
            message: "No default store configured",
          });
        }

        finalRegisterId = store.rows[0].register_id;

       const insertUser = await pool.query(
  `INSERT INTO tbl_login 
   (phone, otp, otp_expiry, user_role, register_id)
   VALUES ($1,$2,$3,'user',$4)
   RETURNING user_id`,
  [phone, newOtp, expiry, finalRegisterId]
);

      }

      await sendSMS(phone, newOtp);

      return res.json({
        status: 1,
        message: "OTP sent successfully",
      });
    }

    /* ================= VERIFY OTP ================= */
    if (!otp) {
      return res.status(400).json({
        status: 0,
        message: "OTP required",
      });
    }

    const result = await pool.query(
      `SELECT * FROM tbl_login
       WHERE phone=$1 
       AND otp=$2 
       AND otp_expiry > NOW()`,
      [phone, otp]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        status: 0,
        message: "Invalid or expired OTP",
      });
    }

    const user = result.rows[0];

    // Clear OTP
    await pool.query(
      `UPDATE tbl_login 
       SET otp=NULL, otp_expiry=NULL 
       WHERE phone=$1`,
      [phone]
    );

    // Attach tenant DB for admin
    if (user.user_role === "admin") {
      const tenant = await pool.query(
        "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
        [user.register_id]
      );
      user.tenant_db = tenant.rows[0]?.db_name || null;
    }

    // Generate JWT
    const token = generateToken({
      user_id: user.user_id,
      register_id: user.register_id,
      role: user.user_role,
    });

    return res.json({
      status: 1,
      message: "Login successful",
      token,
      user: {
        user_id: user.user_id,
        register_id: user.register_id,
        role: user.user_role,
        tenant_db: user.tenant_db || null,
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({
      status: 0,
      message: err.message,
    });
  }
};
