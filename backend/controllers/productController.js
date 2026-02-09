import pool from "../config/masterDB.js";
import XLSX from "xlsx";
import { getTenantPool } from "../config/tenantDB.js";
import productmodel from "../models/productModel.js";
import crypto from "crypto";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import s3 from "../s3.js";




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
      images
    } = req.body;
    const register_id = req.user.register_id

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
    const register_id = req.user.register_id

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
    return res.status(500).json({ status: 0, message: "Server Error", error: err.message });
  }
};

export const createitmfile = async (req, res) => {
  //file=excel file
  //register_id =2  request api


  try {
    if (!req.file) {
      return res.status(400).json({ status: 0, message: "File not uploaded" });
    }

    const register_id = req.user.register_id

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
      return res.status(400).json({ status: 0, message: "Excel contains no data" });
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
      error: err.message
    });
  }
};

export const orderdatas = async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.body;
    const register_id = req.user.register_id;

    if (!register_id) {
      return res.status(400).json({
        status: 0,
        message: "Store ID required",
      });
    }

    // 🔹 GET TENANT DB NAME
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;
    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Store not found",
      });
    }

    // 🔹 GET TENANT DB CONNECTION
    const tenantDB = getTenantPool(result.rows[0].db_name);

    // 🔹 CALL MODEL
    const response = await productmodel.orderdataget(
      tenantDB,
      register_id,
      limit,
      offset
    );

    return res.status(200).json(response);

  } catch (error) {
    console.error("orderdatas error:", error);
    return res.status(500).json({
      status: 0,
      message: "Order fetch failed",
      error: error.message,
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
    const register_id = req.user?.register_id || req.body.register_id;

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
    const catedatares = await productmodel.allcatedetails(tenantDB, register_id, mode_fetchorall, cate_id);

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
    const register_id = req.user?.register_id || req.body.register_id;

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
    const catedatares = await productmodel.catitems(tenantDB, register_id, cate_id);

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
export const Itemslist = async (req, res) => {
  try {
    const register_id = req.user.register_id;
    const { page = 1, limit = 15, search = "" } = req.body;

    if (!register_id) {
      return res.status(400).json({ status: 0, message: "Store ID required" });
    }

    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;
    const tenantRes = await pool.query(tenantQuery, [register_id]);

    if (!tenantRes.rows.length) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

    const result = await productmodel.Itemslist(
      tenantDB,
      register_id,
      page,
      limit,
      search
    );

    return res.status(200).json(result);

  } catch (err) {
    console.error("Items data get Error:", err);
    return res.status(500).json({ status: 0, message: "Server Error" });
  }
};
export const unitlist = async (req, res) => {
  try {
    const register_id = req.user.register_id;

    if (!register_id) {
      return res.status(400).json({ status: 0, message: "Store ID required" });
    }

    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;
    const tenantRes = await pool.query(tenantQuery, [register_id]);

    if (!tenantRes.rows.length) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

    const result = await productmodel.unitlist(
      tenantDB,
      register_id,
    );

    return res.status(200).json(result);

  } catch (err) {
    console.error("Items data get Error:", err);
    return res.status(500).json({ status: 0, message: "Server Error" });
  }
};
export const Optionitems = async (req, res) => {
  try {
    const register_id = req.user.register_id;

    if (!register_id) {
      return res.status(400).json({ status: 0, message: "Store ID required" });
    }

    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;
    const tenantRes = await pool.query(tenantQuery, [register_id]);

    if (!tenantRes.rows.length) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

    const result = await productmodel.Optionitems(
      tenantDB,
      register_id,
    );

    return res.status(200).json(result);

  } catch (err) {
    console.error("Items data get Error:", err);
    return res.status(500).json({ status: 0, message: "Server Error" });
  }
};
export const Lowstockdetails = async (req, res) => {
  try {
    const register_id = req.user?.register_id;
    const { page = 1, limit = 10, search = "", filtertyp } = req.body;

    if (!register_id) {
      return res.status(401).json({
        status: 0,
        message: "Unauthorized"
      });
    }

    const tenantRes = await pool.query(
      `SELECT db_name FROM tbl_tenant_databases WHERE register_id = $1`,
      [register_id]
    );

    if (!tenantRes.rows.length) {
      return res.status(404).json({
        status: 0,
        message: "Store not found"
      });
    }

    const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

    const result = await productmodel.Lowstockdetails(
      tenantDB,
      register_id,
      Number(page),
      Number(limit),
      search,
      filtertyp
    );

    return res.status(200).json(result);
  } catch (err) {
    console.error("Low stock controller error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server Error",
      error: err.message
    });
  }
};


export const uploadToS3 = async (file) => {
  try {
    if (!file || !file.buffer) {
      throw new Error("File buffer missing");
    }

    const fileName = `products/${Date.now()}_${file.originalname}`;

    console.log("📦 S3 Upload Params:", {
      bucket: process.env.AWS_BUCKET_NAME,
      region: process.env.AWS_REGION,
      key: fileName,
      type: file.mimetype,
      size: file.size,
    });

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
      // ACL: "public-read",
    });

    const result = await s3.send(command);

    console.log("✅ S3 Response:", result);

    return `https://${process.env.AWS_BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${fileName}`;

  } catch (err) {
    console.error("🔥 S3 Upload FAILED:", {
      message: err.message,
      code: err.code,
      stack: err.stack,
      requestId: err.$metadata?.requestId,
    });
    throw err;
  }
};


// export const saveItem = async (req, res) => {
//   try {
//     const register_id = req.user.register_id;
//     const product = req.body;
//     const file = req.file;

//     if (!req.file) {
//       return res.status(400).json({
//         status: 0,
//         message: "File not received"
//       });
//     }

//     if (!register_id) {
//       return res.status(400).json({ status: 0, message: "Store ID required" });
//     }

//     const tenantQuery = `
//       SELECT db_name 
//       FROM tbl_tenant_databases 
//       WHERE register_id = $1
//     `;
//     const tenantRes = await pool.query(tenantQuery, [register_id]);

//     if (!tenantRes.rows.length) {
//       return res.status(400).json({ status: 0, message: "Store not found" });
//     }


//     if (file) {
//       const imageUrl = await uploadToS3(file);
//       product.image = imageUrl; // ✅ VERY IMPORTANT
//     } 
// var imageUrl ='';
//     return res.status(400).json({
//       status: 0,
//       message: imageUrl,
//     });
//     const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

//     const result = await productmodel.saveItem(
//       tenantDB,
//       register_id,
//       product
//     );

//     return res.status(200).json(result);

//   } catch (err) {
//     console.error("❌ Items data get Error");

//     console.error({
//       name: err.name,
//       message: err.message,
//       stack: err.stack,
//       code: err.code,
//       statusCode: err.$metadata?.httpStatusCode, // AWS SDK v3
//     });

//     return res.status(500).json({
//       status: 0,
//       message: err.message || "Server Error",
//     });
//   }

// };


export const saveItem = async (req, res) => {
  try {
    const register_id = req.user?.register_id;
    const product = req.body;
    const file = req.file;

    if (!register_id) {
      return res.status(400).json({ status: 0, message: "Store ID required" });
    }
    var  imageUrl ='';

    if (file) {
      // return res.status(400).json({
      //   status: 0,
      //   message: "File not received",
      // });
          // 📤 Upload to S3
    console.log("📤 Uploading to S3...");
     imageUrl = await uploadToS3(file);
    }

    // 🔍 Get tenant DB
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;
    const tenantRes = await pool.query(tenantQuery, [register_id]);

    if (!tenantRes.rows.length) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }


    product.image = imageUrl;
    console.log("✅ Image uploaded:", imageUrl);

    // 💾 Save item
    const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

    const result = await productmodel.saveItem(
      tenantDB,
      register_id,
      product
    );

    return res.status(200).json({
      status: 1,
      message: "Item saved successfully",
      data: result,
      imageUrl,
    });

  } catch (err) {
    console.error("❌ saveItem ERROR FULL:", {
      name: err.name,
      message: err.message,
      stack: err.stack,
      code: err.code,
      statusCode: err.$metadata?.httpStatusCode,
    });

    return res.status(500).json({
      status: 0,
      message: err.message || "Server Error",
    });
  }
};



export const getsuperdeals = async (req, res) => {

  // {
  //   "register_id": 1,
  //   "mode_fetchorall": 0,
  //   "cate_id": 0
  // }

  try {
    // const { mode_fetchorall, cate_id} = req.body;
    const register_id = req.user?.register_id || req.body.register_id;


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
    const catedatares = await productmodel.getsuperdealsmodel(tenantDB, register_id);

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

export const flashsaleprocess = async (req, res) => {

  // {
  //   "from_datetime": ''2025-12-01 22:10:00'',
  //   "to_datetime":'2025-12-11 23:45:00'    
  //   "items_details": [
  //     {
  //       "product_id": 2,
  //       "product_rate": 46
  //     },
  //     {
  //       "product_id": 4,
  //       "product_qty": 10
  //     }
  //   ]
  // }

  try {
    const { from_datetime, to_datetime, items_details } = req.body;
    const register_id = req.user.register_id
    const user_id = req.user.user_id

    if (!register_id) {
      return res.status(400).json({
        status: 0,
        message: "Store ID required",
      });
    }
    if (!items_details) {
      return res.status(400).json({
        status: 0,
        message: "Product Details required",
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
    const orderdatares = await productmodel.flashsalemodel(tenantDB, register_id, user_id, from_datetime, to_datetime, items_details);

    return res.status(200).json(orderdatares);

  } catch (err) {
    console.error("Flash data get Error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server Error",
      error: err.message,
    });
  }
};
export const getflashsale = async (req, res) => {
  try {

    const register_id = req.user.register_id
    const user_id = req.user.user_id

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
    const orderdatares = await productmodel.getflashsale(tenantDB, register_id, user_id);

    return res.status(200).json(orderdatares);

  } catch (err) {
    console.error("Flash data get Error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server Error",
      error: err.message,
    });
  }
};
export const submitpurchase = async (req, res) => {

  // {
  // "purchase_mode":"1",
  // "purchase_id":1,
  // "purchase_header": {
  //     "purchase_date": "2025-12-22"
  // },
  // "purchase_items": [
  //     {
  //     "item_id": 101,
  //     "item_name": "Rices",
  //     "unit_id": 1,
  //     "quantity": 10,
  //     "rate": 50,
  //     "value": 500,
  //     "instore_id": 1,
  //     "outstore_id": 0,
  //     "can_order_status": 1
  //     },
  //     {
  //     "item_id": 102,
  //     "item_name": "Sugar",
  //     "unit_id": 1,
  //     "quantity": 5,
  //     "rate": 40,
  //     "value": 200,
  //     "instore_id": 1,
  //     "outstore_id": 0,
  //     "can_order_status": 1
  //     },
  //     {
  //     "item_id": 103,
  //     "item_name": "Oil",
  //     "unit_id": 2,
  //     "quantity": 2,
  //     "rate": 150,
  //     "value": 300,
  //     "instore_id": 1,
  //     "outstore_id": 0,
  //     "can_order_status": 0
  //     }
  // ]
  // }


  try {
    const register_id = req.user.register_id;
    const user_id = req.user.user_id;

    const {
      purchase_mode,
      purchase_id,
      purchase_header,
      purchase_items
    } = req.body;

    if (!register_id) {
      return res.status(400).json({
        status: 0,
        message: "Store ID required",
      });
    }

    const tenantQuery = `
      SELECT db_name
      FROM tbl_tenant_databases
      WHERE register_id = $1
    `;

    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Store not found"
      });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    let response; // ✅ declare once

    if (purchase_mode == 0) {
      /* INSERT */
      response = await productmodel.submitpurchase(
        tenantDB,
        register_id,
        user_id,
        purchase_header,
        purchase_items
      );

    } else if (purchase_mode == 1) {
      /* UPDATE */
      if (!purchase_id) {
        return res.status(400).json({
          status: 0,
          message: "Purchase ID required for update"
        });
      }

      response = await productmodel.updatepurchase(
        tenantDB,
        register_id,
        user_id,
        purchase_id,
        purchase_header,
        purchase_items
      );

    } else {
      return res.status(400).json({
        status: 0,
        message: "Invalid purchase_mode"
      });
    }

    return res.status(200).json(response);

  } catch (err) {
    console.error("Purchase Error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server Error",
      error: err.message,
    });
  }
};

export const cancelPurchaseItem = async (req, res) => {

  //   {
  //   "purchase_id": 1,
  //   "item_id": 101
  // }

  try {
    const register_id = req.user.register_id;
    const user_id = req.user.user_id;

    const { purchase_id, item_id } = req.body;

    if (!purchase_id || !item_id) {
      return res.status(400).json({
        status: 0,
        message: "purchase_id and item_id required"
      });
    }

    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;
    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Store not found"
      });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    const response = await productmodel.cancelPurchaseItem(
      tenantDB,
      register_id,
      user_id,
      purchase_id,
      item_id
    );

    return res.status(200).json(response);

  } catch (err) {
    console.error("Cancel item error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server Error",
      error: err.message
    });
  }
};

export const cancelPurchase = async (req, res) => {

  //   {
  //   "purchase_id": 1
  // }
  try {
    const register_id = req.user.register_id;
    const user_id = req.user.user_id;

    const { purchase_id } = req.body;

    if (!purchase_id) {
      return res.status(400).json({
        status: 0,
        message: "purchase_id required"
      });
    }

    const tenantQuery = `
      SELECT db_name
      FROM tbl_tenant_databases
      WHERE register_id = $1
    `;
    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Store not found"
      });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    const response = await productmodel.cancelPurchase(
      tenantDB,
      register_id,
      user_id,
      purchase_id
    );

    return res.status(200).json(response);

  } catch (err) {
    console.error("Cancel purchase error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server Error",
      error: err.message
    });
  }
};
export const purchaselist = async (req, res) => {
  try {
    const register_id = req.user.register_id;

    let {
      search = "",
      fromDate = null,
      toDate = null,
      limit = 15,
      offset = 0,
    } = req.body;

    /* ---- OPTIONAL DATE VALIDATION ---- */
    if (fromDate && toDate && new Date(fromDate) > new Date(toDate)) {
      return res.status(400).json({
        status: 0,
        message: "From date cannot be greater than To date",
      });
    }

    /* ---- TENANT DB ---- */
    const tenantQuery = `
      SELECT db_name
      FROM tbl_tenant_databases
      WHERE register_id = $1
    `;
    const tenantRes = await pool.query(tenantQuery, [register_id]);

    if (tenantRes.rows.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Store not found",
      });
    }

    const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

    const response = await productmodel.getPurchaseList(
      tenantDB,
      search,
      fromDate,
      toDate,
      limit,
      offset
    );

    return res.status(200).json(response);

  } catch (err) {
    console.error("Purchase list error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server Error",
      error: err.message,
    });
  }
};

export const getPurchaseEditData = async (req, res) => {
  try {
    const { purchase_id } = req.body;
    const register_id = req.user.register_id;

    if (!purchase_id) {
      return res.json({
        status: 0,
        message: "Purchase ID required",
      });
    }

    /* ---- GET TENANT DB ---- */
    const tenantRes = await pool.query(
      `SELECT db_name FROM tbl_tenant_databases WHERE register_id = $1`,
      [register_id]
    );

    if (tenantRes.rows.length === 0) {
      return res.json({ status: 0, message: "Tenant not found" });
    }

    const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

    /* ---- FETCH DATA ---- */
    const purchaseData = await productmodel.getPurchaseById(tenantDB, purchase_id);

    if (!purchaseData) {
      return res.json({
        status: 0,
        message: "Purchase not found",
      });
    }

    return res.json({
      status: 1,
      data: purchaseData,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: 0,
      message: "Server error",
    });
  }
};
export const getDashboardDatas = async (req, res) => {

  //  {
  //     "chartmode":"year"
  // }
  try {
    const { chartmode, date } = req.body;
    const register_id = req.user.register_id;

    // if (!chartmode) {
    //   return res.json({
    //     status: 0,
    //     message: "chartmode required",
    //   });
    // }

    /* ---- GET TENANT DB ---- */
    const tenantRes = await pool.query(
      `SELECT db_name FROM tbl_tenant_databases WHERE register_id = $1`,
      [register_id]
    );

    if (tenantRes.rows.length === 0) {
      return res.json({ status: 0, message: "Tenant not found" });
    }

    const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

    /* ---- FETCH DATA ---- */
    const DashboardDatas = await productmodel.getDashboardDatas(tenantDB, chartmode, date);

    if (!DashboardDatas) {
      return res.json({
        status: 0,
        message: "tDashboardDatas not found",
      });
    }

    return res.json({
      status: 1,
      data: DashboardDatas,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: 0,
      message: "Server error",
    });
  }
};
export const getChartdetails = async (req, res) => {
  try {
    const { chartmode } = req.body;
    const register_id = req.user.register_id;

    /* ---- GET TENANT DB ---- */
    const tenantRes = await pool.query(
      `SELECT db_name FROM tbl_tenant_databases WHERE register_id = $1`,
      [register_id]
    );

    if (tenantRes.rows.length === 0) {
      return res.json({ status: 0, message: "Tenant not found" });
    }

    const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

    /* ---- FETCH DATA ---- */
    const DashboardDatas = await productmodel.getChartdetails(tenantDB, chartmode);

    if (!DashboardDatas) {
      return res.json({
        status: 0,
        message: "Dashboar Datas not found",
      });
    }

    return res.json({
      status: 1,
      data: DashboardDatas,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      status: 0,
      message: "Server error",
    });
  }
};

export const verifyDeliveryOTP = async (req, res) => {
  try {
    const { order_id, otp } = req.body;
    const register_id = req.user.register_id;

    if (!order_id || !otp) {
      return res.status(400).json({
        status: 0,
        message: "Order ID and OTP required",
      });
    }

    // 🔹 GET TENANT DB
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;
    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Store not found",
      });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    // 🔹 CALL MODEL
    const response = await productmodel.verifyDeliveryOTP(
      tenantDB,
      order_id,
      otp
    );

    return res.status(200).json(response);
  } catch (err) {
    console.error("verifyDeliveryOTP error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server error",
      error: err.message,
    });
  }
};

export const trackOrder = async (req, res) => {
  try {
    const { order_id } = req.body;
    const register_id = req.user.register_id;

    if (!order_id) {
      return res.status(400).json({
        status: 0,
        message: "Order ID required",
      });
    }

    // 🔹 GET TENANT DB
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;
    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Store not found",
      });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    // 🔹 CALL MODEL
    const response = await productmodel.trackOrder(tenantDB, order_id);

    return res.status(200).json(response);
  } catch (err) {
    console.error("trackOrder error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server error",
      error: err.message,
    });
  }
};
export const getDeliveryOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const register_id = req.user.register_id;

    if (!orderId) {
      return res.status(400).json({ status: 0, message: "Order ID required" });
    }

    const tenantRes = await pool.query(
      `SELECT db_name FROM tbl_tenant_databases WHERE register_id = $1`,
      [register_id]
    );

    if (!tenantRes.rowCount) {
      return res.status(404).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(tenantRes.rows[0].db_name);

    const query = `
      SELECT 
        o.order_id,
        a.name,
        a.phone,
        a.full_address
      FROM tbl_master_orders o
      JOIN tbl_address a ON a.user_id = o.user_id
      WHERE o.user_id = $1
    `;

    const result = await tenantDB.query(query, [orderId]);

    if (!result.rowCount) {
      return res.status(404).json({ status: 0, message: "Order not found" });
    }

    return res.json({ status: 1, data: result.rows[0] });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 0, message: "Server error" });
  }
};
export const Superdealdata = async (req, res) => {
  try {
    const register_id = req.user.register_id;

    // 1. Get tenant DB
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;
    const result = await pool.query(tenantQuery, [register_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({
        status: 0,
        message: "Store not found"
      });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    // 2. Call model
    const response = await productmodel.Superdealdata(tenantDB);

    return res.status(200).json(response);

  } catch (err) {
    console.error("Superdealdata error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server error",
      error: err.message
    });
  }
};

export const Superdealmanage = async (req, res) => {
  try {
    const register_id = req.user.register_id;
    const { itmid, mode, disper } = req.body;

    if (!itmid || !mode) {
      return res.status(400).json({
        status: 0,
        message: "Item ID & Mode required"
      });
    }

    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;

    const result = await pool.query(tenantQuery, [register_id]);

    if (!result.rows.length) {
      return res.status(400).json({
        status: 0,
        message: "Store not found"
      });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    const response = await productmodel.Superdealmanage(
      tenantDB,
      itmid,
      Number(mode),
      Number(disper)
    );

    return res.status(200).json(response);

  } catch (err) {
    console.error("Superdealmanage error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server error",
      error: err.message
    });
  }
};
export const StockReport = async (req, res) => {
  try {
    const register_id = req.user.register_id;
    const { reporttyp } = req.body;

    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;

    const result = await pool.query(tenantQuery, [register_id]);

    if (!result.rows.length) {
      return res.status(400).json({
        status: 0,
        message: "Store not found"
      });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    const response = await productmodel.StockReport(
      tenantDB,
      reporttyp
    );

    return res.status(200).json(response);

  } catch (err) {
    console.error("Stock Report error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server error",
      error: err.message
    });
  }
};
export const Searchdata = async (req, res) => {
  try {
    const register_id = req.user.register_id;
    const { searchtxt } = req.body;

    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;

    const result = await pool.query(tenantQuery, [register_id]);

    if (!result.rows.length) {
      return res.status(400).json({
        status: 0,
        message: "Store not found"
      });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    const response = await productmodel.Searchdata(
      tenantDB,
      searchtxt
    );

    return res.status(200).json(response);

  } catch (err) {
    console.error("Searchdata error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server error",
      error: err.message
    });
  }
};
export const SearchItems = async (req, res) => {
  try {
    const register_id = req.user.register_id;
    const { searchtxt } = req.body;

    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;

    const result = await pool.query(tenantQuery, [register_id]);

    if (!result.rows.length) {
      return res.status(400).json({
        status: 0,
        message: "Store not found"
      });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    const response = await productmodel.SearchItems(
      tenantDB,
      searchtxt
    );

    return res.status(200).json(response);

  } catch (err) {
    console.error("Searchdata error:", err);
    return res.status(500).json({
      status: 0,
      message: "Server error",
      error: err.message
    });
  }
};

