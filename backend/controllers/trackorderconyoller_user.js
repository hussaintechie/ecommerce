import pool from "../config/masterDB.js"
import {getTenantPool} from "../config/tenantDB.js"
 import {markOutForDeliveryModel,generateDeliveryOTPModel,verifyDeliveryOTPModel,trackOrderModel} from "../models/trackorderModel_user.js"
export const markOutForDelivery = async (req, res) => {
  try {
    const { order_id } = req.body;
    const register_id = req.user.register_id; 

    if (!order_id) {
      return res.status(400).json({ status: 0, message: "Order ID required" });
    }

    const db = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [register_id]
    );

    if (!db.rows.length) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(db.rows[0].db_name);

    const response = await markOutForDeliveryModel(tenantDB, order_id);
    return res.json(response);
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: 0, message: "Server error" });
  }
};
export const generateDeliveryOTP = async (req, res) => {
  try {
    const { order_id } = req.body;
    const register_id = req.user.register_id;

    const db = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [register_id]
    );

    const tenantDB = getTenantPool(db.rows[0].db_name);

    const response = await generateDeliveryOTPModel(tenantDB, order_id);

    return res.json(response);
  } catch (err) {
    res.status(500).json({ status: 0, message: err.message });
  }
};
export const verifyDeliveryOTP = async (req, res) => {
  try {
    const { order_id, otp } = req.body;
    const register_id = req.user.register_id;

    const db = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [register_id]
    );

    const tenantDB = getTenantPool(db.rows[0].db_name);

    const response = await verifyDeliveryOTPModel(
      tenantDB,
      order_id,
      otp
    );

    return res.json(response);
  } catch (err) {
    res.status(500).json({ status: 0, message: "Server error" });
  }
};
export const trackOrder = async (req, res) => {
  try {
    const { order_id } = req.body;
    const register_id = req.user.register_id;

    const db = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [register_id]
    );

    const tenantDB = getTenantPool(db.rows[0].db_name);

    const response = await trackOrderModel(tenantDB, order_id);
    return res.json(response);
  } catch (err) {
    res.status(500).json({ status: 0, message: "Server error" });
  }
};
