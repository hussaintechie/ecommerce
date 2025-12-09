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
const ordersubmit = async (
  tenantDB, store_id, user_id, address_delivery, total_amount,
  order_status, delivery_id, payment_status, items_details
) => {
  try {

    // Roll number query
    const rollnosql = `SELECT * FROM tbl_rollno_master WHERE rollid = 1`;
    const rollnores = await tenantDB.query(rollnosql);

    const prefix = rollnores.rows[0]?.prefix ?? '';
    const rollid = rollnores.rows[0]?.lastrollid ?? 0;
    const nodigit = rollnores.rows[0]?.nodigit ?? 2;

    const suffix = rollid.toString().padStart(nodigit, '0');
    const rollnum = prefix + suffix;

    // Insert into order master
    const ordsql = `
      INSERT INTO tbl_master_orders 
      (order_no, user_id, address_delivery, total_amount, order_status, delivery_id, payment_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING order_id
    `;

    const orderRes = await tenantDB.query(ordsql, [
      rollnum,
      user_id,
      address_delivery,
      total_amount,
      order_status,
      delivery_id,
      payment_status
    ]);

    const order_id = orderRes.rows[0].order_id;

      await tenantDB.query(`UPDATE tbl_rollno_master SET lastrollid = lastrollid + 1 WHERE rollid = 1`);
    // Insert order items
    for (const item of items_details) {
      const itemSql = `
        INSERT INTO tbl_master_order_items 
        (order_id, product_id, product_name, product_unit, product_qty, product_rate, product_amount, discount_amt, discount_per)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8 ,$9)
      `;

      await tenantDB.query(itemSql, [
        order_id,
        item.product_id,
        item.product_name,
        item.product_unit,
        item.product_qty,
        item.product_rate,
        item.product_amount,
        item.discount_amt,
        item.discount_per
      ]);
    }

    // Update roll number
  

    return { status: 1, message: "Order Saved Successfully", order_no: rollnum, order_id };

  } catch (error) {
    console.error("Order save error:", error);
    return { status: 0, message: "Order save failed", error };
  }
};

const allcatedetails = async (tenantDB, store_id, mode_fetchorall, cate_id) => {
  try {

    let catetsql = `SELECT * FROM tbl_master_categories`;
    let params = [];

    if (mode_fetchorall == 1) {
      catetsql += ` WHERE categories_id = $1`;
      params.push(cate_id);
    }



    const result = await tenantDB.query(catetsql, params);

    return { status: 1, message: "Category fetched", data: result.rows };

  } catch (error) {
    console.error("Category fetch error:", error);
    return { status: 0, message: "Fetch failed", error };
  }
};
const catitems = async (tenantDB, store_id, cate_id) => {
  try {

    let cateitmsql = `select * from tbl_master_product as itm where categories_id =${cate_id}`;
    
    const result = await tenantDB.query(cateitmsql);

    return { status: 1, message: "Items fetched", data: result.rows };

  } catch (error) {
    console.error("Items fetch error:", error);
    return { status: 0, message: "Items Fetch failed", error };
  }
};
const getuserorders = async (tenantDB, store_id, userid) => {
  try {
    const userordersql = `SELECT * FROM tbl_master_orders WHERE user_id = ${userid}`;

    const result = await tenantDB.query(userordersql);
    let data = {
      processed: [],
      delivered: [],
      cancelled: []
    };


    for (const item of result.rows) {
      if (item.order_status === "Process") {
        data.processed.push(item);
      }
      else if (item.order_status === "Delivered") {
        data.delivered.push(item);
      }
      else if (item.order_status === "Cancelled") {
        data.cancelled.push(item);
      }
    }

    return { 
      status: 1, 
      message: "User orders fetched successfully",
      data: data 
    };

  } catch (error) {
    console.error("Items fetch error:", error);
    return { status: 0, message: "Items Fetch failed", error };
  }
};
const singleorddetail = async (tenantDB, store_id, orderid) => {
  try {

    const userorderitmsql = `
      SELECT 
        itm.product_name AS itmname, 
        SUM(itm.product_amount) AS itmamt,
        itm.product_qty AS qty,
        um.unitname AS unit
      FROM tbl_master_order_items AS itm
      INNER JOIN unitofmeasure_master AS um  
        ON itm.product_unit = um.unitid 
      WHERE itm.order_id = ${orderid}
      GROUP BY itm.product_id, itm.product_name, itm.product_qty, um.unitname
    `;


    const orderothrsql = `
      SELECT  
        SUM(itm.product_amount) AS itmamt,
        SUM(itm.discount_amt) AS disamt,
        ord.address_delivery AS address,
        pay.method AS pay_method,
        TO_CHAR(ord.created_at, 'DD-Mon-YYYY') AS pay_date
      FROM tbl_master_orders AS ord
      INNER JOIN tbl_master_order_items AS itm 
        ON ord.order_id = itm.order_id
      INNER JOIN tbl_master_payment AS pay 
        ON pay.order_id = ord.order_id
      WHERE ord.order_id = ${orderid}
      GROUP BY ord.order_id, pay.method, ord.address_delivery
    `;

    const itmresult = await tenantDB.query(userorderitmsql);
    const otherresult = await tenantDB.query(orderothrsql);

    let data = {
      itmdetails: [],
      address: null,
      billdetails: {},
      paydetails: {}
    };


    for (const item of itmresult.rows) {
      data.itmdetails.push(item);
    }


    if (otherresult.rows.length > 0) {
      const info = otherresult.rows[0];

      data.address = info.address;

      data.billdetails = {
        bill_amount: info.itmamt,
        discount_amount: info.disamt
      };

      data.paydetails = {
        pay_mode: info.pay_method,
        pay_date: info.pay_date
      };
    }

    return { 
      status: 1, 
      message: "Order details fetched successfully",
      data: data 
    };

  } catch (error) {
    console.error("Order fetch error:", error);
    return { status: 0, message: "Order Fetch failed", error };
  }
};


// EXPORT DEFAULT
export default {
  neweditcat,
  bulkuploaditm,
  orderdataget,
  ordersubmit,
  allcatedetails,
  catitems,
  getuserorders,
  singleorddetail
};
