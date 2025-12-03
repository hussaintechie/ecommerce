// productmodel.js

const neweditcat = async (tenantDB, category_name, sts, mode, catid) => {
  try {

    if (mode === 0) {
      // CHECK IF CATEGORY EXISTS
      const checkExt = await tenantDB.query(
        `SELECT * FROM tbl_master_categories WHERE categories_name = $1`,
        [category_name]
      );

      if (checkExt.rowCount > 0) {
        return { status: 0, message: "Category already exists" };
      }

      // INSERT NEW CATEGORY
      const insert = await tenantDB.query(
        `INSERT INTO tbl_master_categories (categories_name, cat_sts)
         VALUES ($1, $2)
         RETURNING categories_id`,
        [category_name, sts]
      );

      return {
        status: 1,
        message: "Category added successfully",
        category_id: insert.rows[0].categories_id,
      };

    } else if (mode === 1) {
      // CHECK IF CATEGORY EXISTS (EXCEPT CURRENT ONE)
      const checkExt = await tenantDB.query(
        `SELECT * FROM tbl_master_categories 
         WHERE categories_name = $1 AND categories_id <> $2`,
        [category_name, catid]
      );

      if (checkExt.rowCount > 0) {
        return { status: 0, message: "Category already exists" };
      }

      // UPDATE CATEGORY
      const update = await tenantDB.query(
        `UPDATE tbl_master_categories 
         SET categories_name = $1, cat_sts = $2 
         WHERE categories_id = $3`,
        [category_name, sts, catid]
      );

      return {
        status: 1,
        message: "Category updated successfully",
        category_id: catid,
      };
    }

  } catch (error) {
    console.error("Error in product model:", error);
    return { status: 0, message: "Database error", error };
  }
};

const bulkuploaditm = async (tenantDB, fullqry) => {
  try {
    await tenantDB.query("DELETE FROM tmp_tbl_master_product");
    await tenantDB.query(fullqry);

    // Insert missing categories
    const catsql = `
      INSERT INTO tbl_master_categories (categories_name, cat_sts)
      SELECT DISTINCT TRIM(a.categoriesname), 1
      FROM tmp_tbl_master_product a
      LEFT JOIN tbl_master_categories b
        ON TRIM(a.categoriesname) = TRIM(b.categories_name)
      WHERE b.categories_name IS NULL
    `;
    await tenantDB.query(catsql);

    // Insert missing units
    const unitsql = `
      INSERT INTO unitofmeasure_master (unitshortcode, unitname, isbaseunit, baseunitid, decimalbasefactor)
      SELECT DISTINCT TRIM(ub.unit) as unit1, TRIM(ub.unit) as unit2, 1, 0, 100
      FROM tmp_tbl_master_product ub
      LEFT JOIN unitofmeasure_master ua
        ON TRIM(ub.unit) = TRIM(ua.unitshortcode)
      WHERE ua.unitshortcode IS NULL
    `;

    // console.log(unitsql ,'unitsql');
    await tenantDB.query(unitsql);

    // Insert new products
    const productsql = `
      INSERT INTO tbl_master_product (categories_id, title, description, price, mrp, quantity, unit)
      SELECT
        COALESCE(b.categories_id, 0),
        COALESCE(a.title, ''),
        COALESCE(a.description, ''),
        COALESCE(a.price, 0),
        COALESCE(a.mrp, 0),
        COALESCE(a.quantity, 0),
        COALESCE(c.unitid, 7)
      FROM tmp_tbl_master_product a
      LEFT JOIN tbl_master_categories b 
        ON TRIM(a.categoriesname) = TRIM(b.categories_name)
      LEFT JOIN unitofmeasure_master c 
        ON TRIM(a.unit) = TRIM(c.unitshortcode)
      LEFT JOIN tbl_master_product pdt 
        ON TRIM(a.title) = TRIM(pdt.title)
      WHERE pdt.title IS NULL
    `;
    await tenantDB.query(productsql);

    return { status: 1, message: "Items uploaded successfully" };

  } catch (error) {
    console.error("Bulk upload error:", error);
    return { status: 0, message: "Upload failed", error };
  }
};
const orderdataget = async (tenantDB, store_id, limit, offset, searchtxt) => {
//   {
// "store_id" :1,
// "limit" :20,
// "offset" :0,
// "searchtxt":"hai",
// "fromdate":"2025-01-02",
// "todate":"2025-11-30"
// } api request
  
  try {
    const productsql = `
      SELECT 
        r.order_no,
        r.total_amount,
        COALESCE('tesat','') AS client,
        r.payment_status,
        r.order_status,
        d.delivery_mode,
        TO_CHAR(r.created_at, 'DD-MM-YYYY HH12:MI AM') AS created_at
      FROM tbl_master_orders r
      INNER JOIN tbl_delivery_modes d ON r.delivery_id = d.delivery_id
      ORDER BY r.created_at DESC
      LIMIT $1 OFFSET $2;
    `;

    const result = await tenantDB.query(productsql, [limit, offset]);

    return { status: 1, message: "Order fetched", data: result.rows };

  } catch (error) {
    console.error("Order fetch error:", error);
    return { status: 0, message: "Fetch failed", error };
  }
};
const addProductsManual = async (tenantDB, products) => {
  try {
    for (const p of products) {
      const {
        title,
        categories_id,
        description = "",
        price = 0,
        mrp = 0,
        quantity = 0,
        unit_id,
        images = []
      } = p;

      // Validation
      if (!title || !categories_id || !unit_id) {
        return {
          status: 0,
          message: "title, categories_id & unit_id are required"
        };
      }

      // Check Category Exists
      const catCheck = await tenantDB.query(
        `SELECT categories_id FROM tbl_master_categories WHERE categories_id = $1`,
        [categories_id]
      );

      if (catCheck.rowCount === 0) {
        return { status: 0, message: `Category ID ${categories_id} not found` };
      }

      // Check Unit Exists
      const unitCheck = await tenantDB.query(
        `SELECT unitid FROM unitofmeasure_master WHERE unitid = $1`,
        [unit_id]
      );

      if (unitCheck.rowCount === 0) {
        return { status: 0, message: `Unit ID ${unit_id} not found` };
      }

      // Insert Product
      const insertProduct = await tenantDB.query(
        `INSERT INTO tbl_master_product 
         (categories_id, title, description, price, mrp, quantity, unit)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING product_id`,
        [categories_id, title, description, price, mrp, quantity, unit_id]
      );

      const product_id = insertProduct.rows[0].product_id;

      // Insert Images (optional)
      for (const img of images) {
        await tenantDB.query(
          `INSERT INTO tbl_product_images (product_id, image_url)
           VALUES ($1, $2)`,
          [product_id, img]
        );
      }
    }

    return { status: 1, message: "Product(s) added successfully" };

  } catch (error) {
    console.error("Product insert error:", error);
    return { status: 0, message: "Insert failed", error };
  }
};

export const getProductsByCategory = async (tenantDB) => {
  const query = `
    SELECT 
      c.categories_id,
      c.categories_name,
      p.product_id,
      p.title,
      p.description,
      p.price,
      p.mrp,
      p.quantity,
      pi.image_url
    FROM tbl_master_categories c
    LEFT JOIN tbl_master_product p 
          ON c.categories_id = p.categories_id
    LEFT JOIN tbl_product_images pi 
          ON p.product_id = pi.product_id
    ORDER BY c.categories_id, p.product_id;
  `;

  const result = await tenantDB.query(query);
   


  // Group into categories → products → images
  const categories = {};

  result.rows.forEach(row => {
    if (!categories[row.categories_id]) {
      categories[row.categories_id] = {
        categories_id: row.categories_id,
        categories_name: row.categories_name,
        products: []
      };
    }
  console.log("hussain")
    // If product exists add image and hussain
    if (row.product_id) {
      
      let product = categories[row.categories_id].products.find(
        p => p.product_id === row.product_id
      );

      if (!product) {
        product = {
          product_id: row.product_id,
          title: row.title,
          description: row.description,
          price: row.price,
          mrp: row.mrp,
          quantity: row.quantity,
          images: []
        };
        categories[row.categories_id].products.push(product);
      }

      if (row.image_url) {
        product.images.push(`http://localhost:5000/uploads/products/${row.image_url}`);
      }
    }
  });

  return Object.values(categories);
};

// EXPORT DEFAULT
export default {
  getProductsByCategory,
  neweditcat,
  bulkuploaditm,
  orderdataget,
  addProductsManual
};
