import pool from "../config/masterDB.js";
import { getTenantPool } from "../config/tenantDB.js";

// IMPORT MODEL FUNCTIONS
import { insertProduct, insertProductImage } from "../models/productModel.js";

export const addCategoryProduct = async (req, res) => {
  try {
    const {
      store_id,
      category_id,   // <-- category_id comes from frontend
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
      !category_id ||
      !title ||
      !price ||
      !mrp ||
      !quantity ||
      !thumbnail
    ) {
      return res.status(400).json({
        message: "All fields are required",
      });
    }

    // 1. GET TENANT DB NAME USING STORE_ID
    const result = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [store_id]
    );

    if (result.rows.length === 0)
      return res.status(400).json({ message: "Store not found" });

    const tenantDB = getTenantPool(result.rows[0].db_name);

    // 2. INSERT PRODUCT using model
    const productId = await insertProduct(tenantDB, {
      category_id,
      title,
      description,
      price,
      mrp,
      quantity,
      thumbnail,
    });

    // 3. INSERT MULTIPLE IMAGES using model
    if (Array.isArray(images)) {
      for (let img of images) {
        await insertProductImage(tenantDB, productId, img);
      }
    }

    res.json({
      status: 1,
      message: "Product + Images added successfully",
      product_id: productId,
    });

  } catch (err) {
    console.error("Add Product Error:", err);
    res.status(500).json({ error: err.message });
  }
};
