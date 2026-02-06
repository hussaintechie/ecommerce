import pool from "../config/masterDB.js";
import { getTenantPool } from "../config/tenantDB.js";

export const tenantLoader = async (req, res, next) => {
  try {
    const register_id = req.user?.register_id;

    if (!register_id) return next();

    const result = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [register_id]
    );

    if (result.rows.length === 0) {
      return res.status(500).json({ message: "Tenant DB not found" });
    }

    const dbName = result.rows[0].db_name;
    req.tenantDB = getTenantPool(dbName);

    next();
  } catch (err) {
    console.error("Tenant Loader Error:", err);
    res.status(500).json({ error: "Tenant DB load failed" });
  }
};
