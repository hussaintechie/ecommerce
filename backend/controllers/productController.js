import pool from "../config/masterDB.js";
import { getTenantPool } from "../config/tenantDB.js";

export const addCategoryProduct = async (req, res) => {
  try {
    const {
      store_id,
      category_name,
      title,
      description,
      price,
      mrp,
      quantity,
      thumbnail,
      images
    } = req.body;

    if (
      !store_id ||
      !category_name ||
      !title ||
      !price ||
      !mrp ||
      !quantity ||
      !thumbnail
    ) {
      return res.status(400).json({
        message: "All fields required",
      });
    }

    // 1. GET TENANT DB NAME USING REGISTER_ID
    const result = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [store_id]
    );

    if (result.rows.length === 0)
      return res.status(400).json({ message: "Store not found" });

    const tenantDB = getTenantPool(result.rows[0].db_name);

    // 2. INSERT CATEGORY
    const categoryInsert = await tenantDB.query(
      `INSERT INTO tbl_master_categories (categories_name)
       VALUES ($1)
       RETURNING categories_id`,
      [category_name]
    );

    const categoryId = categoryInsert.rows[0].categories_id;

    // 3. INSERT PRODUCT
    const productInsert = await tenantDB.query(
      `INSERT INTO tbl_master_product
        (categories_id, title, description, price, mrp, quantity, thumbnail)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING product_id`,
      [categoryId, title, description, price, mrp, quantity, thumbnail]
    );

    const productId = productInsert.rows[0].product_id;

    // 4. INSERT MULTIPLE PRODUCT IMAGES
    if (Array.isArray(images)) {
      for (let img of images) {
        await tenantDB.query(
          `INSERT INTO tbl_master_product_images (product_id, imageurl)
           VALUES ($1,$2)`,
          [productId, img]
        );
      }
    }

    res.json({
      status: 1,
      message: "Category + Product + Images added successfully",
      category_id: categoryId,
      product_id: productId,
    });

  } catch (err) {
    console.error("Add Category+Product Error:", err);
    res.status(500).json({ error: err.message });
  }
};
