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

// Generate OTP
const generateOTP = () => Math.floor(100000 + Math.random() * 900000);

// SEND SMS (same)
const sendSMS = async (phone, otp) => {
  if (process.env.NODE_ENV !== "production") {
    console.log(`DEV MODE OTP for ${phone} →`, otp);
    return true;
  }

  const url = "https://www.fast2sms.com/dev/bulkV2";

  await axios.post(url, {
      route: "v3",
      sender_id: "TXTIND",
      message: `Your OTP is ${otp}`,
      language: "english",
      numbers: phone
    },
    { headers: { authorization: process.env.FAST2SMS_API_KEY } }
  );

  return true;
};

// LOGIN CONTROLLER (WITH JWT)
export const login = async (req, res) => {
  try {
    const { phone, otp, sendOtp } = req.body;

    if (!phone) return res.status(400).json({ message: "Phone required" });

    // Step 1 → Send OTP
    if (sendOtp) {
      const newOtp = generateOTP();

      const userCheck = await pool.query(
        "SELECT * FROM tbl_login WHERE phone=$1",
        [phone]
      );

      if (userCheck.rows.length === 0) {
        const store = await pool.query(`SELECT register_id FROM tbl_register LIMIT 1`);

        await pool.query(
          `INSERT INTO tbl_login (phone, otp, user_role, register_id)
           VALUES ($1,$2,$3,$4)`,
          [phone, newOtp, "user", store.rows[0].register_id]
        );
      } else {
        await pool.query("UPDATE tbl_login SET otp=$1 WHERE phone=$2", [newOtp, phone]);
      }

      await sendSMS(phone, newOtp);

      return res.json({ status: 1, message: "OTP sent" });
    }

    // Step 2 → Verify OTP
    if (!otp) return res.status(400).json({ message: "OTP required" });

    const result = await pool.query(
      "SELECT * FROM tbl_login WHERE phone=$1 AND otp=$2",
      [phone, otp]
    );

    if (result.rows.length === 0)
      return res.status(400).json({ message: "Incorrect OTP" });

    const user = result.rows[0];

    // Clear OTP
    await pool.query("UPDATE tbl_login SET otp=NULL WHERE phone=$1", [phone]);

    // Admin → Attach DB
    if (user.user_role === "admin") {
      const tenant = await pool.query(
        "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
        [user.register_id]
      );
      user.tenant_db = tenant.rows[0]?.db_name;
    }

    // 🎉 GENERATE JWT TOKEN HERE
    const token = generateToken(user);

    return res.json({
      status: 1,
      message: "Login success",
      token,
      user
    });

  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ message: "Login failed" });
  }
};
