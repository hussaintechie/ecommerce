import deliveryPartnerModel from "../models/deliveryPartnerModel.js";
import pool from "../config/masterDB.js";
import { getTenantPool } from "../config/tenantDB.js";

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
      req.body
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
export const getDeliveryOrderDetails = async (req, res) => {
  try {
    const { orderId  } = req.params; // <-- from URL
    const register_id = req.user.register_id;

    if (!orderId) {
      return res.status(400).json({
        status: 0,
        message: "Order ID required",
      });
    }

    // 1️⃣ Get tenant DB
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;
    const tenantRes = await pool.query(tenantQuery, [register_id]);

    if (!tenantRes.rows.length) {
      return res.status(404).json({
        status: 0,
        message: "Store not found",
      });
    }

    const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

    // 2️⃣ MAIN QUERY (FIXED COLUMN NAME)
    const query = `
      SELECT 
        o.order_id,
        o.order_no,
        a.name, 
        a.phone,
        a.address
      FROM tbl_master_orders o
      JOIN tbl_address a ON a.user_id = o.user_id
      WHERE o.order_id = $1
    `;

    const result = await tenantDB.query(query, [orderId]);

    if (!result.rows.length) {
      return res.status(404).json({
        status: 0,
        message: "Order not found",
      });
    }

    return res.status(200).json({
      status: 1,
      data: result.rows[0],
    });

  } catch (error) {
    console.error("Delivery fetch error:", error);
    return res.status(500).json({
      status: 0,
      message: "Server error",
    });
  }
};
