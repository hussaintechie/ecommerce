import pool from "../config/masterDB";
import getTenantPool from "../config/tenantDB";

export const FavoriteModel = {
  getTenantDB: async (store_id) => {
    const db = await pool.query(
      `select db_name from tbl_tenant_databases where register_id=$1`,
      [store_id]
    );
    if (db.rows.length === 0) throw new Error("Invalid store");
    return getTenantPool(db.rows[0].db_name);
  },
  addFavorite: async (tenantPool, user_id, product_id) => {
    const result = await tenantPool.query(
      `INSERT INTO tbl_favorites(user_id,product_id)
        VALUES($1,$2)
        RETURNING fav_id `,
      [user_id, product_id]
    );

    return result.rows[0].fav_id;
  },
  removeFavorite: async (tenantPool, user_id, product_id) => {
    await tenantPool.query(
      `DELETE FROM tbl_favorites WHERE user_id=$1 AND product_id=$2`,
      [user_id, product_id]
    );
  },
  checkFavorite: async (tenantPool, user_id, product_id) => {
    const result = await tenantPool.query(
      `
      select fav_id from tbl_favorites where user_id=$1 AND product_id=%2`,
      [user_id, product_id]
    );
    return result.rows;
  },
  listFavorites: async (tenantPool, user_id) => {
    const result = await tenantPool.pool(`
      SELECT  f.fav_id,p.* from tbl_favorites f
      JOIN tbl_master_product P ON f.product_id=p.product_id
      WHERE f.user_id= $1
      `,[user_id]);
      return result.rows
  },
};
