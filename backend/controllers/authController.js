import pool from "../config/db.js";

import nodemailer from "nodemailer";

export const adminRegister = async (req, res) => {
  try {
    const { phone, store_name, email_id } = req.body;

    if (!phone || !store_name || !email_id) {
      return res.status(400).json({
        status: -1,
        message: "All fields required",
      });
    }

    // Check if admin exists
    const exists = await pool.query(
      "SELECT * FROM tbl_register WHERE phone = $1 AND email_id=  $2",
      [phone, email_id]
    );

    if (exists.rows.length > 0) {
      return res.status(400).json({
        status: 1,
        message: "Admin already exists",
      });
    }

    // Insert into tbl_register
    const reg = await pool.query(
      `INSERT INTO tbl_register (phone, store_name, email_id)
       VALUES ($1, $2, $3) RETURNING register_id`,
      [phone, store_name, email_id]
    );

    const register_id = reg.rows[0].register_id;

    // Insert into tbl_login
    await pool.query(
      `INSERT INTO tbl_login (phone, register_id,email, user_role)
       VALUES ($1, $2,$3,'admin')`,
      [phone, register_id, email_id]
    );

    res.json({
      status: 2,
      message: "Admin registered successfully",
      register_id,
    });
  } catch (err) {
    console.error("Actual Error:", err);
    res.status(500).json({ error: err.message });
  }
};

const generateOTP = () => Math.floor(100000 + Math.random() * 900000);

// =========================================================================
// SINGLE LOGIN API: SEND OTP + LOGIN (OTP/PASSWORD) + AUTO SIGNUP + ADMIN
// =========================================================================
export const login = async (req, res) => {
  try {
    const { email, otp, password, sendOtp } = req.body;

    if (!email) return res.status(400).json({ message: "Email required" });

    // ===============================================================
    // 🔹 STEP 1: USER PRESSED "SEND OTP"
    // ===============================================================
    if (sendOtp === true) {
      const newOtp = generateOTP();

      // Check if account exists
      const check = await pool.query("SELECT * FROM tbl_login WHERE email=$1", [
        email,
      ]);

      if (check.rows.length === 0) {
        // Check admin table
        const adminCheck = await pool.query(
          "SELECT * FROM tbl_register WHERE email_id=$1",
          [email]
        );

        let role = "user";
        let registerId = null;

        if (adminCheck.rows.length > 0) {
          role = "admin";
          registerId = adminCheck.rows[0].register_id;
        }

        // Create new user row
        await pool.query(
          `INSERT INTO tbl_login (email,user_role, register_id, otp)
           VALUES ($1, $2, $3, $4)`,
          [email, role, registerId, newOtp]
        );
      } else {
        // Update OTP only
        await pool.query("UPDATE tbl_login SET otp=$1 WHERE email=$2", [
          newOtp,
          email,
        ]);
      }

      // Send OTP email
      const transport = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
      });

      await transport.sendMail({
        to: email,
        subject: "Your Login OTP",
        text: `Your OTP is ${newOtp}`,
      });

      return res.json({
        status: 1,
        message: "OTP sent to email",
      });
    }

    // ===============================================================
    // 🔹 STEP 2: NORMAL LOGIN (OTP OR PASSWORD)
    // ===============================================================

    if (!otp && !password)
      return res.status(400).json({ message: "Enter OTP or Password" });

    const userCheck = await pool.query(
      "SELECT * FROM tbl_login WHERE email=$1",
      [email]
    );

    let user = null;

    // -----------------------------------------------------------
    // CASE A: NEW USER → AUTO SIGNUP
    // -----------------------------------------------------------
    if (userCheck.rows.length === 0) {
      let role = "user";
      let registerId = null;

      const adminCheck = await pool.query(
        "SELECT * FROM tbl_register WHERE email_id=$1",
        [email]
      );

      if (adminCheck.rows.length > 0) {
        role = "admin";
        registerId = adminCheck.rows[0].register_id;
      }

      const inserted = await pool.query(
        `INSERT INTO tbl_login (email, password, otp, user_role, register_id)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [email, password || null, otp || null, role, registerId]
      );

      user = inserted.rows[0];

      return res.json({
        status: 1,
        message: "Signup & Login successful",
        role: user.user_role,
      });
    }

    // -----------------------------------------------------------
    // CASE B: EXISTING USER → LOGIN
    // -----------------------------------------------------------
    user = userCheck.rows[0];

    // OTP LOGIN
    if (otp) {
      if (user.otp !== otp)
        return res.status(400).json({ message: "Invalid OTP" });

      await pool.query("UPDATE tbl_login SET otp=NULL WHERE email=$1", [email]);

      return res.json({
        status: 1,
        message: "OTP Login successful",
        role: user.user_role,
      });
    }

    // PASSWORD LOGIN
    if (password) {
      // First time password creation
      if (!user.password) {
        await pool.query("UPDATE tbl_login SET password=$1 WHERE email=$2", [
          password,
          email,
        ]);

        return res.json({
          status: 1,
          message: "Password created & Login successful",
          role: user.user_role,
        });
      }

      // Existing password check
      if (user.password !== password)
        return res.status(400).json({ message: "Incorrect password" });

      return res.json({
        status: 1,
        message: "Password Login successful",
        role: user.user_role,
      });
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Login failed" });
  }
};
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) return res.status(400).json({ message: "Email is required" });

    // Check if user exists
    const userCheck = await pool.query(
      "SELECT * FROM tbl_login WHERE email=$1",
      [email]
    );

    if (userCheck.rows.length === 0)
      return res.status(400).json({ message: "Account not found" });

    const otp = Math.floor(100000 + Math.random() * 900000);

    // Save OTP in DB
    await pool.query("UPDATE tbl_login SET otp=$1 WHERE email=$2", [
      otp,
      email,
    ]);

    // Send email
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.MAIL_USER, pass: process.env.MAIL_PASS },
    });

    await transporter.sendMail({
      to: email,
      subject: "Reset Password OTP",
      text: `Your OTP to reset your password is ${otp}`,
    });

    return res.json({
      status: 1,
      message: "OTP sent to your email",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "OTP sending failed" });
  }
};
export const resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword)
      return res.status(400).json({ message: "All fields required" });

    // Validate OTP
    const check = await pool.query(
      "SELECT * FROM tbl_login WHERE email=$1 AND otp=$2",
      [email, otp]
    );

    if (check.rows.length === 0)
      return res.status(400).json({ message: "Invalid OTP" });

    // Update password
    await pool.query(
      "UPDATE tbl_login SET password=$1, otp=NULL WHERE email=$2",
      [newPassword, email]
    );

    return res.json({
      status: 1,
      message: "Password reset successful",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: "Reset password failed" });
  }
};
