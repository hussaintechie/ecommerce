import pool from "../config/db.js";
import jwt from "jsonwebtoken";
import axios from "axios";

export const adminRegister = async (req, res) => {
  try {
    const { phone, store_name, email_id } = req.body;

    if (!phone || !store_name || !email_id) {
      return res.status(400).json({ message: "All fields required" });
    }

    // Check if admin exists
    const exists = await pool.query(
      "SELECT * FROM tbl_register WHERE phone = $1",
      [phone]
    );

    if (exists.rows.length > 0) {
      return res.status(400).json({ message: "Admin already exists" });
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
      `INSERT INTO tbl_login (phone, register_id, user_role)
       VALUES ($1, $2, 'admin')`,
      [phone, register_id]
    );

    res.json({
      status: 1,
      message: "Admin registered successfully",
      register_id,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Server error" });
  }
};



export const sendOTP = async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({ message: "Phone number required" });
    }

    const otp = Math.floor(1000 + Math.random() * 9000);

    // Check if phone exists
    const user = await pool.query(
      "SELECT * FROM tbl_login WHERE phone = $1",
      [phone]
    );

    if (user.rows.length === 0) {
      await pool.query(
        `INSERT INTO tbl_login (phone, user_role, otp)
         VALUES ($1, 'user', $2)`,
        [phone, otp]
      );
    } else {
      await pool.query(
        `UPDATE tbl_login SET otp=$1 WHERE phone=$2`,
        [otp, phone]
      );
    }

    // SEND OTP
    const fastURL = "https://www.fast2sms.com/dev/bulkV2";

    const payload = {
      route: "otp",
      message: `Your OTP is ${otp}`,
      language: "english",
      numbers: phone,
    };

    await axios.post(fastURL, payload, {
      headers: { authorization: process.env.FAST2SMS_API_KEY },
    });

    res.json({ status: 1, message: "OTP sent successfully" });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "OTP sending failed" });
  }
};



export const verifyOTP = async (req, res) => {
  try {
    const { phone, otp } = req.body;

    const result = await pool.query(
      "SELECT * FROM tbl_login WHERE phone=$1 AND otp=$2",
      [phone, otp]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    const user = result.rows[0];

    // Clear OTP
    await pool.query("UPDATE tbl_login SET otp=NULL WHERE phone=$1", [phone]);

    const token = jwt.sign(
      { user_id: user.user_id, role: user.user_role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({
      status: 1,
      message: "Login successful",
      token,
      user_id: user.user_id,
      role: user.user_role,
    });
  } catch (err) {
    console.log(err);
    res.status(500).json({ message: "Login failed" });
  }
};

