import pool from "../config/masterDB.js";
import { getTenantPool } from "../config/tenantDB.js";
export const getReviewStatus = async (req, res) => {
  try {
    const { user_id, register_id } = req.user;

    const tenantRes = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [register_id]
    );

    const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

    const result = await tenantDB.query(
      "SELECT is_reviewed FROM tbl_customer_review WHERE user_id=$1",
      [user_id]
    );

    return res.json({
      status: 1,
      isReviewed: result.rowCount > 0
    });

  } catch (err) {
    res.status(500).json({ status: 0, message: "Server error" });
  }
};
export const submitCustomerReview = async (req, res) => {
  try {
    const { rating, tags, comment } = req.body;
    const { user_id, register_id } = req.user;

    const tenantRes = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [register_id]
    );

    const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

    // 🔒 Check if already reviewed
    const exists = await tenantDB.query(
      "SELECT 1 FROM tbl_customer_review WHERE user_id=$1",
      [user_id]
    );

    if (exists.rowCount) {
      return res.status(400).json({
        status: 0,
        message: "Review already submitted"
      });
    }

    await tenantDB.query(
      `INSERT INTO tbl_customer_review (user_id, rating, tags, comment)
       VALUES ($1, $2, $3, $4)`,
      [user_id, rating, tags, comment]
    );

    return res.json({
      status: 1,
      message: "Review submitted successfully"
    });

  } catch (err) {
    res.status(500).json({ status: 0, message: "Server error" });
  }
};
