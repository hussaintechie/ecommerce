import pool from "../config/masterDB.js";
import { getTenantPool } from "../config/tenantDB.js";
import { insertCategory } from "../models/categoryModel.js";

export const addCategory = async (req, res) => {
  try {
    const { store_id, category_name } = req.body;

    const dbName = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [store_id]
    );

    if (dbName.rows.length === 0)
      return res.status(400).json({ message: "Store not found" });

    const tenantDB = getTenantPool(dbName.rows[0].db_name);

    const category_id = await insertCategory(tenantDB, category_name);

    res.json({ status: 1, message: "Category added", category_id });
  } catch (err) {
    res.status(500).json({ 
        status:1,
        error: err.message });
  }
};
