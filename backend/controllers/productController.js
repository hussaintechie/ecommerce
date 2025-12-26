import pool from "../config/masterDB.js";
import XLSX from "xlsx";
import { getTenantPool } from "../config/tenantDB.js";
import productmodel from "../models/productModel.js"

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
    const register_id=req.user.register_id

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
    const {  category_name, sts, mode, catid } = req.body;
    const register_id=req.user.register_id

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

    const register_id=req.user.register_id

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

//   {
// "register_id" :1,
// "limit" :20,
// "offset" :0,
// "searchtxt":"hai",
// "fromdate":"2025-01-02",
// "todate":"2025-11-30"
// } api request
  try {
    const {  limit = 20, offset = 0, searchtxt = '' } = req.body;
    const register_id=req.user.register_id

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

// {
//   "register_id": 1,
//   "product_id": 12,
//   "user_id": 3,
//   "address_delivery": "72/1 ,siruvadi",
//   "total_amount": 238,
//   "order_status": "Pending",
//   "delivery_id": 2,
//   "payment_status": "Failed",
//   "items_details": [
//     {
//       "product_id": 2,
//       "product_name": "Test",
//       "product_qty": 35,
//       "product_unit": 4,
//       "product_rate": 46,
//       "product_amount": 98,
//       "discount_amt": 56,
//       "discount_per": 40
//     },
//     {
//       "product_id": 4,
//       "product_name": "Sample",
//       "product_qty": 10,
//       "product_unit": 1,
//       "product_amount": 98,
//       "product_rate": 80,
//       "discount_amt": 10,
//       "discount_per": 5
//     }
//   ]
// }

  try {
    const {address_delivery ,total_amount ,order_status ,delivery_id ,payment_status ,items_details} = req.body;
    const register_id=req.user.register_id
    const user_id=req.user.user_id

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
    const orderdatares = await productmodel.ordersubmit(tenantDB,register_id,user_id ,address_delivery ,total_amount ,order_status ,delivery_id ,payment_status,items_details);

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


export const allcatedetails = async (req, res) => {

// {
//   "register_id": 1,
//   "mode_fetchorall": 0,
//   "cate_id": 0
// }

  try {
    const { mode_fetchorall, cate_id} = req.body;
    const register_id=req.user.register_id

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
    const catedatares = await productmodel.allcatedetails(tenantDB,register_id,mode_fetchorall ,cate_id);

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
    const {cate_id} = req.body;
    const register_id=req.user.register_id

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
    const catedatares = await productmodel.catitems(tenantDB,register_id ,cate_id);

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

export const getuserorders = async (req, res) => {

// {
//   "register_id": 1,
//   "userid": 3
// }
  try {
    const  userid = req.user.user_id;
    const register_id=req.user.register_id

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
    const userorderres = await productmodel.getuserorders(tenantDB,register_id ,userid);

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
    const {orderid} = req.body;
   const register_id=req.user.register_id
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
    const userorderres = await productmodel.singleorddetail(tenantDB,register_id ,orderid);

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
export const getsuperdeals = async (req, res) => {

// {
//   "register_id": 1,
//   "mode_fetchorall": 0,
//   "cate_id": 0
// }

  try {
   // const { mode_fetchorall, cate_id} = req.body;
    const register_id=req.user.register_id

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
    const catedatares = await productmodel.getsuperdealsmodel(tenantDB,register_id);

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
    const {from_datetime ,to_datetime ,items_details } = req.body;
    const register_id=req.user.register_id
    const user_id=req.user.user_id

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
    const orderdatares = await productmodel.flashsalemodel(tenantDB,register_id,user_id ,from_datetime ,to_datetime ,items_details);

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

    const register_id=req.user.register_id
    const user_id=req.user.user_id

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
    const orderdatares = await productmodel.getflashsale(tenantDB,register_id,user_id);

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




