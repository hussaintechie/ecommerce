import pool from "../config/masterDB.js";
import XLSX from "xlsx";
import { getTenantPool } from "../config/tenantDB.js";
import productmodel from "../models/productModel.js";


export const neweditcategory = async (req, res) => {

  //  {
  //     "category_name":"FOOD Items76",
  //     "store_id" : 1,
  //     "sts" : 1,
  //     "mode" :1,
  //     "catid" : 1
  //} API REQUEST PARAMETER

  try {
    const {category_name, sts, mode, catid } = req.body;
    const store_id =req.user.store_id;

    // VALIDATION
    if (!store_id || !category_name) {
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
    const result = await pool.query(tenantQuery, [store_id]);

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
  //store_id =2  request api


  try {
    if (!req.file) {
      return res.status(400).json({ status: 0, message: "File not uploaded" });
    }

    const store_id =req.user.store_id;

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
    const result = await pool.query(tenantQuery, [store_id]);

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
// "store_id" :1,
// "limit" :20,
// "offset" :0,
// "searchtxt":"hai",
// "fromdate":"2025-01-02",
// "todate":"2025-11-30"
// } api request
  try {
    const {  limit = 20, offset = 0, searchtxt = '' } = req.body;
     const store_id =req.user.store_id;

    if (!store_id) {
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

    const result = await pool.query(tenantQuery, [store_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    // Call model function
    const orderdatares = await productmodel.orderdataget(
      tenantDB,
      store_id,
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
export const addProduct = async (req, res) => {
  try {
    const { products } = req.body;
     const store_id =req.user.store_id;

    if (!store_id) {
      return res.status(400).json({ status: 0, message: "store_id is required" });
    }

    if (!Array.isArray(products) || products.length === 0) {
      return res.status(400).json({ status: 0, message: "products array required" });
    }

    // Get Tenant DB
    const tenantQuery = `
      SELECT db_name FROM tbl_tenant_databases WHERE register_id = $1
    `;
    const result = await pool.query(tenantQuery, [store_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    // Call Model
    const response = await productmodel.addProductsManual(tenantDB, products);

    return res.status(200).json(response);

  } catch (err) {
    console.error("Add Product Error:", err);
    return res.status(500).json({ status: 0, message: "Server error", error: err.message });
  }
};

export const getProductsByCategory = async (req, res) => {
  try {
    const store_id =req.user.store_id;

    if (!store_id) {
      return res.status(400).json({ status: 0, message: "store_id required" });
    }

    // Find tenant DB
    const tenantQuery = `
      SELECT db_name 
      FROM tbl_tenant_databases 
      WHERE register_id = $1
    `;

    const result = await pool.query(tenantQuery, [store_id]);

    if (result.rows.length === 0) {
      return res.status(400).json({ status: 0, message: "Store not found" });
    }

    const tenantDB = getTenantPool(result.rows[0].db_name);

    // Call Model
    const response = await productmodel.getProductsByCategory(tenantDB);

    return res.status(200).json({
      status: 1,
      message: "Success",
      data: response
    });

  } catch (err) {
    console.error("Get Category Wise Product Error:", err);
    return res.status(500).json({ status: 0, message: "Server error", error: err.message });
  }
};

