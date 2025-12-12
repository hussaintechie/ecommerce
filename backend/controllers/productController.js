import pool from "../config/masterDB.js";
import XLSX from "xlsx";
import { getTenantPool } from "../config/tenantDB.js";
import productmodel from "../models/productModel.js";
import crypto from "crypto";

// -----------------------------
// Razorpay Signature Validation
// -----------------------------
function isValidRazorpaySignature(orderId, paymentId, signature) {
  const body = `${orderId}|${paymentId}`;

  const expected = crypto
    .createHmac("sha256", process.env.RAZORPAY_SECRET)
    .update(body)
    .digest("hex");

  return expected === signature;
}

export const addCategoryProduct = async (req, res) => {
  try {
    const {
      category_name,
      title,
      description,
      price,
      mrp,
      quantity,
      thumbnail,
      images,
    } = req.body;
    const register_id = req.user.register_id;

    if (
      !register_id ||
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
      [register_id]
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

export const neweditcategory = async (req, res) => {
  //  {
  //     "category_name":"FOOD Items76",
  //     "register_id" : 1,
  //     "sts" : 1,
  //     "mode" :1,
  //     "catid" : 1
  //} API REQUEST PARAMETER

  try {
    const { category_name, sts, mode, catid } = req.body;
    const register_id = req.user.register_id;

    // VALIDATION
    if (!register_id || !category_name) {
      return res.status(400).json({
        status: 0,
        message: "Store ID and Category Name required",
      });
    }

    // MODE VALIDATION (mode can be 0 or 1)
    if (mode === undefined || mode === null) {
      return res.status(400).json({
        status: 0,
        message: "Incorrect Mode",
      });
    }

    // GET TENANT DB NAME
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;
    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    // CREATE TENANT DATABASE CONNECTION
    const tenantDB = getTenantPool(result.rows[0].db_name);

    // CALL MODEL
    const categoryResponse = await productmodel.neweditcat(
      tenantDB,
      category_name,
      sts,
      mode,
      catid
    );

    return res.status(200).json(categoryResponse);
  } catch (err) {
    console.error("Add Category Error:", err);
    return res
      .status(500)
      .json({ status: 0, message: "Server Error", error: err.message });
  }
};

export const createitmfile = async (req, res) => {
  //file=excel file
  //register_id =2  request api

  try {
    if (!req.file) {
      return res.status(400).json({ status: 0, message: "File not uploaded" });
    }

    const register_id = req.user.register_id;

    // Read Excel buffer
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const rows = XLSX.utils.sheet_to_json(sheet);

    // Get Tenant DB
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;
    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    console.log("Excel Data:", rows);

    // Prepare VALUES query
    let values = [];

    for (const item of rows) {
      const title = (item.title || "").replace(/'/g, "''");
      const categoriesname = (item.categoriesname || "").replace(/'/g, "''");
      const description = (item.description || "").replace(/'/g, "''");
      const price = item.price || 0;
      const mrp = item.mrp || 0;
      const quantity = item.quantity || 0;
      const unit = (item.unit || "").replace(/'/g, "''");

      values.push(
        `('${title}','${categoriesname}','${description}',${price},${mrp},${quantity},'${unit}')`
      );
    }

    if (values.length === 0) {
      return res
        .status(400)
        .json({ status: 0, message: "Excel contains no data" });
    }

    await tenantDB.query("DELETE FROM tmp_tbl_master_product");

    const fullqry = `
      INSERT INTO tmp_tbl_master_product 
      (title, categoriesname, description, price, mrp, quantity, unit) 
      VALUES ${values.join(",")}
    `;

    // Call model
    const blkuploadres = await productmodel.bulkuploaditm(tenantDB, fullqry);

    return res.status(200).json(blkuploadres);
  } catch (err) {
    console.error("Upload Items Error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server Error",
      error: err.message,
    });
  }
};

export const orderdatas = async (req, res) => {
  //   {
  // "register_id" :1,
  // "limit" :20,
  // "offset" :0,
  // "searchtxt":"hai",
  // "fromdate":"2025-01-02",
  // "todate":"2025-11-30"
  // } api request
  try {
    const { limit = 20, offset = 0, searchtxt = "" } = req.body;
    const register_id = req.user.register_id;

    if (!register_id) {
      return res.status(400).json({
        status: 0,
        message: "Store ID required",
      });
    }

    // Get Customer DB name (tenant)
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;

    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    // Call model function
    const orderdatares = await productmodel.orderdataget(
      tenantDB,
      register_id,
      limit,
      offset,
      searchtxt
    );

    return res.status(200).json(orderdatares);
  } catch (err) {
    console.error("Order data get Error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server Error",
      error: err.message,
    });
  }
};

export const submitorder = async (req, res) => {
  try {
    const {
      address_delivery,
      total_amount,
      order_status,
      delivery_id,
      payment_status,
      payment_method,
      razorpay_payment_id,
      razorpay_order_id, // ← MUST ADD
      razorpay_signature,
      items_details,
    } = req.body;

    const register_id = req.user.register_id;
    const user_id = req.user.user_id;

    if (!register_id) {
      return res.status(400).json({ status: 0, message: "Store ID required" });
    }

    if (!items_details || items_details.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Product Details required",
      });
    }
    if (payment_method === "Online") {
      const isValid = isValidRazorpaySignature(
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature
      );

      if (!isValid) {
        return res.status(400).json({
          status: 0,
          message: "Invalid Razorpay signature",
        });
      }
    }

    // Get tenant DB
    const t = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [register_id]
    );

    if (t.rows.length === 0)
      return res.status(400).json({ status: 0, message: "Store not found" });

    const tenantDB = getTenantPool(t.rows[0].db_name);

    // Insert order + items
    const orderdatares = await productmodel.ordersubmit(
      tenantDB,
      register_id,
      user_id,
      address_delivery,
      total_amount,
      order_status,
      delivery_id,
      payment_status,
      items_details
    );

    const newOrderId = orderdatares.order_id;

    // Payment ID
    const externalPayId = razorpay_payment_id || "COD"; // Razorpay or COD
    const transaction_id =
      payment_method === "Online" ? razorpay_payment_id : null;
    // Insert payment row
    await tenantDB.query(
      `INSERT INTO tbl_master_payment
       (order_id,transaction_id, method, external_payment_id, status)
       VALUES ($1, $2, $3, $4,$5)`,
      [
        newOrderId,
        transaction_id,
        payment_method,
        externalPayId,
        payment_status,
      ]
    );

    return res.status(200).json({
      status: 1,
      message: "Order submitted successfully",
      order_no: orderdatares.order_no,
      order_id: newOrderId,
    });
  } catch (err) {
    console.error("Order Submit Error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server Error",
      error: err.message,
    });
  }
};

export const allcatedetails = async (req, res) => {
  // {
  //   "register_id": 1,
  //   "mode_fetchorall": 0,
  //   "cate_id": 0
  // }

  try {
    const { mode_fetchorall, cate_id } = req.body;
    const register_id = req.user.register_id;

    if (!register_id) {
      return res.status(400).json({
        status: 0,
        message: "Store ID required",
      });
    }

    // Get Customer DB name (tenant)
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;

    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    // Call model function
    const catedatares = await productmodel.allcatedetails(
      tenantDB,
      register_id,
      mode_fetchorall,
      cate_id
    );

    return res.status(200).json(catedatares);
  } catch (err) {
    console.error("Category data get Error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server Error",
      error: err.message,
    });
  }
};
export const catitems = async (req, res) => {
  // {
  //   "register_id": 1,
  //   "cate_id": 0
  // }

  try {
    const { cate_id } = req.body;
    const register_id = req.user.register_id;

    if (!register_id) {
      return res.status(400).json({
        status: 0,
        message: "Store ID required",
      });
    }

    // Get Customer DB name (tenant)
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;

    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    // Call model function
    const catedatares = await productmodel.catitems(
      tenantDB,
      register_id,
      cate_id
    );

    return res.status(200).json(catedatares);
  } catch (err) {
    console.error("Items data get Error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server Error",
      error: err.message,
    });
  }
};
export const getuserorders = async (req, res) => {
  // {
  //   "register_id": 1,
  //   "userid": 3
  // }
  try {
    const userid = req.user.user_id;
    const register_id = req.user.register_id;

    if (!register_id) {
      return res.status(400).json({
        status: 0,
        message: "Store ID required",
      });
    }
    if (!userid) {
      return res.status(400).json({
        status: 0,
        message: "User ID required",
      });
    }

    // Get Customer DB name (tenant)
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;

    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    // Call model function
    const userorderres = await productmodel.getuserorders(
      tenantDB,
      register_id,
      userid
    );

    return res.status(200).json(userorderres);
  } catch (err) {
    console.error("user order data get Error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server Error",
      error: err.message,
    });
  }
};
export const singleorddetail = async (req, res) => {
  // {
  //   "register_id": 1,
  //   "orderid": 3
  // }
  try {
    const { orderid } = req.body;
    const register_id = req.user.register_id;
    if (!register_id) {
      return res.status(400).json({
        status: 0,
        message: "Store ID required",
      });
    }
    if (!orderid) {
      return res.status(400).json({
        status: 0,
        message: "Order ID required",
      });
    }

    // Get Customer DB name (tenant)
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;

    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    // Call model function
    const userorderres = await productmodel.singleorddetail(
      tenantDB,
      register_id,
      orderid
    );

    return res.status(200).json(userorderres);
  } catch (err) {
    console.error("order data get Error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server Error",
      error: err.message,
    });
  }
};
