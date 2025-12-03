// middleware/authMiddleware.js
import pool from "../config/masterDB.js";

export const authVerify = async (req, res, next) => {
  try {
    // 1) Get user_id and store_id from body OR query OR headers
    const userIdRaw =
      req.body?.user_id ??
      req.query?.user_id ??
      req.headers["x-user-id"];

    const storeIdRaw =
      req.body?.store_id ??
      req.query?.store_id ??
      req.headers["x-store-id"];

    // 2) If missing → 401
    if (!userIdRaw || !storeIdRaw) {
      return res
        .status(401)
        .json({ status: 0, message: "Missing user_id or store_id" });
    }

    // 3) Convert to numbers (Postgres returns integers)
    const user_id = Number(userIdRaw);
    const store_id = Number(storeIdRaw);

    if (Number.isNaN(user_id) || Number.isNaN(store_id)) {
      return res
        .status(400)
        .json({ status: 0, message: "Invalid user_id or store_id" });
    }

    // 4) Validate store exists
    const storeCheck = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [store_id]
    );

    if (storeCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ status: 0, message: "Invalid store_id" });
    }

    // 5) Validate that user belongs to this store
    //  NOTE: your table column is user_id (PK in tbl_login)
    const userCheck = await pool.query(
      "SELECT user_role FROM tbl_login WHERE user_id=$1 AND register_id=$2",
      [user_id, store_id]
    );

    if (userCheck.rows.length === 0) {
      return res
        .status(403)
        .json({ status: 0, message: "User not part of this store" });
    }

    // 6) Attach verified user info to req
    req.user = {
      user_id,
      store_id,
      role: userCheck.rows[0].user_role,
    };

    // 7) Move to controller
    next();
  } catch (err) {
    console.error("Auth verify error:", err);
    return res
      .status(500)
      .json({ status: 0, message: "Auth verification failed" });
  }
};
