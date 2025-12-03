import pool from "../config/masterDB.js";
import { getTenantPool } from "../config/tenantDB.js";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";


export const adminRegister = async (req, res) => {
  try {
    const { phone, store_name, email_id } = req.body;

    if (!phone || !store_name || !email_id)
      return res.status(400).json({ message: "All fields required" });

    // Check admin exists
    const exists = await pool.query(
      "SELECT * FROM tbl_register WHERE phone=$1 AND email_id=$2",
      [phone, email_id]
    );

    if (exists.rows.length > 0)
      return res.status(400).json({ message: "Admin already exists" });

    // Insert new admin
    const reg = await pool.query(
      `INSERT INTO tbl_register (phone, store_name, email_id)
       VALUES ($1,$2,$3) RETURNING register_id`,
      [phone, store_name, email_id]
    );

    const register_id = reg.rows[0].register_id;

    // Create login
    await pool.query(
      `INSERT INTO tbl_login (email, register_id, user_role)
       VALUES ($1,$2,'admin')`,
      [email_id, register_id]
    );

    // TENANT DB NAME
    const dbName = store_name.toLowerCase().replace(/\s+/g, "_");

    // Create tenant DB
    await pool.query(`CREATE DATABASE ${dbName}`);

    // Save tenant mapping
   await pool.query(
  `INSERT INTO tbl_tenant_databases (register_id, db_name, db_user, db_pass, port)
   VALUES ($1, $2, $3, $4, $5)`,
  [
    register_id,
    dbName,
    process.env.DB_USER,   // postgres
    process.env.DB_PASS,   // root
    process.env.DB_PORT    // 5433
  ]
);


    // Load tenant DB connection
    const tenantPool = getTenantPool(dbName);

    // Run tenant schema
    const schemaPath = path.join("tenant", "tenantSchema.sql");
    const schema = fs.readFileSync(schemaPath).toString();

    await tenantPool.query(schema);

    res.json({
      status: 1,
      message: "Admin registered + Tenant DB created",
      register_id,
      dbName,
    });
  } catch (err) {
    console.error("Admin Register Error:", err);
    res.status(500).json({ error: err.message });
  }
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000);

// ====================================
// LOGIN (OTP + PASSWORD + AUTO SIGNUP)
// ====================================
export const login = async (req, res) => {
  try {
    const { email, otp, password, sendOtp } = req.body;

    if (!email) return res.status(400).json({ message: "Email required" });

    // ===============================
    // STEP 1: SEND OTP
    // ===============================
    if (sendOtp) {
      const newOtp = generateOTP();

      const userCheck = await pool.query(
        "SELECT * FROM tbl_login WHERE email=$1",
        [email]
      );

      if (userCheck.rows.length === 0) {
        // Check if email belongs to an admin
        const adminCheck = await pool.query(
          "SELECT * FROM tbl_register WHERE email_id=$1",
          [email]
        );

        let role = "user";
        let registerId;

        if (adminCheck.rows.length > 0) {
          // Admin login
          role = "admin";
          registerId = adminCheck.rows[0].register_id;
        } else {
          // New user → Assign to only store for now
          const store = await pool.query(
            "SELECT register_id FROM tbl_register LIMIT 1"
          );
          registerId = store.rows[0].register_id;
        }

        // Insert new login row
        await pool.query(
          `INSERT INTO tbl_login (email, user_role, register_id, otp)
           VALUES ($1,$2,$3,$4)`,
          [email, role, registerId, newOtp]
        );
      } else {
        // Existing user → Update OTP
        await pool.query(`UPDATE tbl_login SET otp=$1 WHERE email=$2`, [
          newOtp,
          email,
        ]);
      }

      // Send OTP mail
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
      });

      await transporter.sendMail({
        to: email,
        subject: "Your Login OTP",
        text: `Your OTP is ${newOtp}`,
      });

      return res.json({ status: 1, message: "OTP sent" });
    }

    // ===============================
    // STEP 2: NORMAL LOGIN
    // ===============================
    const userCheck = await pool.query(
      "SELECT * FROM tbl_login WHERE email=$1",
      [email]
    );

    let user = userCheck.rows[0];

    // -------------------------------------
    // AUTO SIGNUP (when logging in first time)
    // -------------------------------------
    if (!user) {
      let role = "user";
      let registerId;

      const adminCheck = await pool.query(
        "SELECT * FROM tbl_register WHERE email_id=$1",
        [email]
      );

      if (adminCheck.rows.length > 0) {
        role = "admin";
        registerId = adminCheck.rows[0].register_id;
      } else {
        const store = await pool.query(
          "SELECT register_id FROM tbl_register LIMIT 1"
        );
        registerId = store.rows[0].register_id;
      }

      const insert = await pool.query(
        `INSERT INTO tbl_login (email, password, otp, user_role, register_id)
         VALUES ($1,$2,$3,$4,$5) RETURNING *`,
        [email, password || null, otp || null, role, registerId]
      );

      user = insert.rows[0];

      return res.json({
        status: 1,
        message: "Signup + Login success",
        role: user.user_role,
        register_id: user.register_id,
      });
    }

    // ===============================
    // OTP LOGIN
    // ===============================
    if (otp) {
      if (user.otp !== otp)
        return res.status(400).json({ message: "Invalid OTP" });

      await pool.query("UPDATE tbl_login SET otp=NULL WHERE email=$1", [email]);

      // Attach tenant DB if admin
      if (user.user_role === "admin") {
        const tenant = await pool.query(
          "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
          [user.register_id]
        );
        user.tenant_db = tenant.rows[0].db_name;
      }

      return res.json({
        status: 1,
        message: "OTP Login success",
        role: user.user_role,
        register_id: user.register_id,
        tenant_db: user.tenant_db || null,
      });
    }

    // ===============================
    // PASSWORD LOGIN
    // ===============================
    if (password) {
      // First time setting password
      if (!user.password) {
        await pool.query(`UPDATE tbl_login SET password=$1 WHERE email=$2`, [
          password,
          email,
        ]);

        if (user.user_role === "admin") {
          const tenant = await pool.query(
            "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
            [user.register_id]
          );
          user.tenant_db = tenant.rows[0].db_name;
        }

        return res.json({
          status: 1,
          message: "Password created + Login success",
          role: user.user_role,
          register_id: user.register_id,
          tenant_db: user.tenant_db || null,
        });
      }

      // Normal password login
      if (user.password !== password)
        return res.status(400).json({ message: "Incorrect password" });

      if (user.user_role === "admin") {
        const tenant = await pool.query(
          "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
          [user.register_id]
        );
        user.tenant_db = tenant.rows[0].db_name;
      }

      return res.json({
        status: 1,
        message: "Password Login success",
        role: user.user_role,
        register_id: user.register_id,
        tenant_db: user.tenant_db || null,
      });
    }

  } catch (err) {
    console.error("Login Error:", err);
    return res.status(500).json({ message: "Login failed" });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: "Email required" });

    const userCheck = await pool.query(
      "SELECT * FROM tbl_login WHERE email=$1",
      [email]
    );

    if (userCheck.rows.length === 0)
      return res.status(400).json({ message: "Account not found" });

    const otp = generateOTP();

    await pool.query("UPDATE tbl_login SET otp=$1 WHERE email=$2", [
      otp,
      email,
    ]);

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    });

    await transporter.sendMail({
      to: email,
      subject: "Reset Password OTP",
      text: `Your OTP is ${otp}`,
    });

    res.json({ status: 1, message: "OTP sent to your email" });
  } catch (err) {
    console.error("Forgot Password Error:", err);
    res.status(500).json({ message: "OTP sending failed" });
  }
};
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword)
      return res.status(400).json({ message: "All fields required" });

    const check = await pool.query(
      "SELECT * FROM tbl_login WHERE email=$1 AND otp=$2",
      [email, otp]
    );

    if (check.rows.length === 0)
      return res.status(400).json({ message: "Invalid OTP" });

    await pool.query(
      "UPDATE tbl_login SET password=$1, otp=NULL WHERE email=$2",
      [newPassword, email]
    );

    res.json({ status: 1, message: "Password reset successful" });
  } catch (err) {
    console.error("Reset Error:", err);
    res.status(500).json({ message: "Reset failed" });
  }
};
