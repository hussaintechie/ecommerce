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

  //   insert into tbl_product_images (product_id ,image_url)values(2,'C:\Users\Dell\Downloads\product_img\onion2.'),
  // (2,'C:\Users\Dell\Downloads\product_img\oninon');

  try {

    let cateitmsql = `SELECT DISTINCT ON (itm.product_id)
  itm.product_id,
  itm.title,
  itm.price,
  itm.mrp,
  itm.description,
  prdimg.image_url AS image
FROM tbl_master_product itm
LEFT JOIN tbl_product_images prdimg
  ON itm.product_id = prdimg.product_id
WHERE itm.categories_id = ${cate_id}
ORDER BY itm.product_id`;

    const result = await tenantDB.query(cateitmsql);

    return {
      status: 1,
      message: "Items fetched",
      data: result.rows
    };

  } catch (error) {
    console.error("Items fetch error:", error);
    return { status: 0, message: "Items Fetch failed", error };
  }
};

const Itemslist = async (tenantDB, store_id, page, limit, search) => {
  try {
    const offset = (page - 1) * limit;

    const whereClause = search
      ? `WHERE LOWER(itm.title) LIKE LOWER($1)`
      : "";

    const dataSql = `
      SELECT DISTINCT ON (itm.product_id)
        itm.product_id AS id,
        itm.title AS name,
        cat.categories_name as category,
        itm.categories_id,
        itm.price,
        itm.mrp,
        itm.description,
        'Active' as status,
        prdimg.image_url AS image
      FROM tbl_master_product itm
      LEFT JOIN tbl_product_images prdimg 
        ON itm.product_id = prdimg.product_id
      inner join tbl_master_categories as cat on itm.categories_id = cat.categories_id		
      ${whereClause}
      ORDER BY itm.product_id
      LIMIT $${search ? 2 : 1} OFFSET $${search ? 3 : 2}
    `;

    //console.log(dataSql ,'dataSql');

    const countSql = `
      SELECT COUNT(*) 
      FROM tbl_master_product as itm
      ${whereClause}
    `;

    const values = search
      ? [`%${search}%`, limit, offset]
      : [limit, offset];

    const countValues = search ? [`%${search}%`] : [];

    const [items, total] = await Promise.all([
      tenantDB.query(dataSql, values),
      tenantDB.query(countSql, countValues),
    ]);

    return {
      status: 1,
      message: "Items fetched",
      data: items.rows,
      total: Number(total.rows[0].count),
    };
  } catch (error) {
    console.error("Items fetch error:", error);
    return { status: 0, message: "Items Fetch failed" };
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

const getsuperdealsmodel = async (tenantDB) => {

  //   insert into tbl_product_images (product_id ,image_url)values(2,'C:\Users\Dell\Downloads\product_img\onion2.'),
  // (2,'C:\Users\Dell\Downloads\product_img\oninon');

  try {

    let sql = `select 
DISTINCT ON (pro.product_id)
  pro.product_id,
title as name,
COALESCE(discount_per, 0.0) AS discount,
CASE
  WHEN COALESCE(discount_sts, 0) = 1
  THEN ROUND(
    price - (price * COALESCE(discount_per, 0.0) / 100),
    2
  )
  ELSE price
END AS price,
price AS "oldPrice",
img.image_url as img,
unit.unitname as "weight"
from tbl_master_product as pro left join tbl_product_images as img 
on pro.product_id = img.product_id
inner join unitofmeasure_master as unit on pro.unit = unit.unitid`;

    let dealitmsql = ` where discount_per > 0  and discount_sts =1`;

    let freshveg = ` where coalesce(itm_spctyp,'') ='vegitable'`;

    let sessfruit = ` where coalesce(itm_spctyp,'') ='fruit'`;

    let recowher = ` WHERE pro.categories_id IN (
  SELECT DISTINCT ON (p2.categories_id)
    p2.categories_id
  FROM tbl_master_order_items oi
  INNER JOIN tbl_master_product p2 
    ON oi.product_id = p2.product_id
  ORDER BY p2.categories_id, oi.order_id DESC
  LIMIT 500
)
ORDER BY pro.product_id
LIMIT 50;`;

    const orderBy = `
ORDER BY pro.product_id
`;
    const result = await tenantDB.query(sql + dealitmsql + orderBy);
    const vedresult = await tenantDB.query(sql + freshveg + orderBy);
    const fritresult = await tenantDB.query(sql + sessfruit + orderBy);
    const recoresult = await tenantDB.query(sql + recowher);



    return {
      status: 1,
      message: "Items fetched",
      data: {
        deals: result.rows,
        veg: vedresult.rows,
        fruit: fritresult.rows,
        reco: recoresult.rows
      }
    };

  } catch (error) {
    console.error("Items fetch error:", error);
    return { status: 0, message: "Items Fetch failed", error };
  }
};
const flashsalemodel = async (
  tenantDB,
  register_id,
  user_id,
  from_datetime,
  to_datetime,
  items_details
) => {
  const client = tenantDB;

  try {
    await client.query('BEGIN');

    // 1️⃣ Get Roll Number
    const rollnosql = `
      SELECT prefix, lastrollid, nodigit
      FROM tbl_rollno_master
      WHERE rollid = 2
      FOR UPDATE
    `;
    const rollnores = await client.query(rollnosql);

    if (rollnores.rowCount === 0) {
      throw new Error('Roll number not found');
    }

    const { prefix, lastrollid, nodigit } = rollnores.rows[0];
    const nextRoll = lastrollid + 1;
    const rollnum = `${prefix}${nextRoll.toString().padStart(nodigit, '0')}`;

    // 2️⃣ Insert Flash Sale Header
    const headersql = `
      INSERT INTO tbl_flashsale_header
      (register_id, flash_no, from_datetime, to_datetime, created_userid, updated_userid)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING flsh_trnid
    `;

    const headerRes = await client.query(headersql, [
      register_id,
      rollnum,
      from_datetime,
      to_datetime,
      user_id,
      user_id
    ]);

    const flashsale_id = headerRes.rows[0].flsh_trnid;

    // 3️⃣ Insert Flash Sale Items
    const itemSql = `
      INSERT INTO tbl_flashsale_trans
      (flsh_trnid, product_id, product_rate)
      VALUES ($1, $2, $3)
    `;

    for (const item of items_details) {
      await client.query(itemSql, [
        flashsale_id,
        item.product_id,
        item.product_rate
      ]);
    }

    // 4️⃣ Update Roll Number
    const rollupdatesql = `
      UPDATE tbl_rollno_master
      SET lastrollid = lastrollid + 1
      WHERE rollid = 2
    `;
    await client.query(rollupdatesql);

    await client.query('COMMIT');

    return {
      status: 1,
      message: 'Flash Sale Saved Successfully',
      flash_no: rollnum,
      flashsale_id
    };

  } catch (error) {
    await tenantDB.query('ROLLBACK');
    console.error('Flash Sale save error:', error);

    return {
      status: 0,
      message: 'Flash Sale save failed',
      error: error.message
    };
  }
};

const getflashsale = async (tenantDB, store_id) => {
  try {

    let flashsql = `
SELECT 
  pro.title,
  ft.product_rate,
  fh.from_datetime,
  fh.to_datetime
FROM tbl_flashsale_header AS fh
INNER JOIN tbl_flashsale_trans AS ft 
  ON fh.flsh_trnid = ft.flsh_trnid
INNER JOIN tbl_master_product AS pro 
  ON ft.product_id = pro.product_id
WHERE register_id =${store_id} and NOW() BETWEEN fh.from_datetime AND fh.to_datetime`;
    const result = await tenantDB.query(flashsql);

    return { status: 1, message: "Flash Sale fetched", data: result.rows };

  } catch (error) {
    console.error("Flash Sale fetch error:", error);
    return { status: 0, message: "Fetch failed", error };
  }
};


const submitpurchase = async (
  tenantDB,
  register_id,
  user_id,
  purchase_header,
  purchase_items
) => {
  try {
    await tenantDB.query("BEGIN");

    /* 1️⃣ Get Roll Number */
    const rollnosql = `
      SELECT prefix, lastrollid, nodigit 
      FROM tbl_rollno_master 
      WHERE rollid = 3
    `;
    const rollnores = await tenantDB.query(rollnosql);

    if (rollnores.rows.length === 0) {
      throw new Error("Roll number not configured");
    }

    const { prefix, lastrollid, nodigit } = rollnores.rows[0];
    const rollnum = prefix + String(lastrollid).padStart(nodigit, "0");

    /* 2️⃣ Insert Purchase Header */
    const headerSql = `
      INSERT INTO purchase_header
      (purchasedate, purchase_no, storeid, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING purchaseid
    `;

    const headerRes = await tenantDB.query(headerSql, [
      purchase_header.purchase_date,
      rollnum,
      register_id,
      user_id,
      user_id
    ]);

    const purchase_id = headerRes.rows[0].purchaseid;

    /* 3️⃣ Update Roll Number */
    await tenantDB.query(
      `UPDATE tbl_rollno_master 
       SET lastrollid = lastrollid + 1 
       WHERE rollid = 3`
    );

    /* 4️⃣ Insert Item-wise Stock Transactions */
    const itemSql = `
      INSERT INTO stock_transaction
      (purchase_id, purchase_date, instoreid, outstoreid,
       itmid, itmname, unitid, stockqty, rate, value, currentstock,canordersts)
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
    `;

    for (const item of purchase_items) {
      await tenantDB.query(itemSql, [
        purchase_id,
        purchase_header.purchase_date,
        item.instore_id,
        item.outstore_id,
        item.item_id,
        item.item_name,
        item.unit_id,
        item.quantity,
        item.rate,
        item.value,
        item.quantity,
        item.can_order_status
      ]);
    }

    await tenantDB.query("COMMIT");

    return {
      status: 1,
      message: "Purchase Saved Successfully",
      purchase_no: rollnum,
      purchase_id
    };

  } catch (error) {
    await tenantDB.query("ROLLBACK");
    console.error("Purchase save error:", error);

    return {
      status: 0,
      message: "Purchase save failed",
      error: error.message
    };
  }
};


const updatepurchase = async (
  tenantDB,
  register_id,
  user_id,
  purchase_id,
  purchase_header,
  purchase_items
) => {
  try {
    await tenantDB.query("BEGIN");

    /* 1️⃣ Check Purchase Exists */
    const chkSql = `
      SELECT purchaseid, purchase_no
      FROM purchase_header
      WHERE purchaseid = $1 AND storeid = $2
    `;
    const chkRes = await tenantDB.query(chkSql, [purchase_id, register_id]);

    if (chkRes.rows.length === 0) {
      throw new Error("Purchase not found");
    }

    const purchase_no = chkRes.rows[0].purchase_no;

    /* 2️⃣ Update Header */
    const headerSql = `
      UPDATE purchase_header
      SET purchasedate = $1,
          updated_at = $2,
          updated_datetime = CURRENT_TIMESTAMP
      WHERE purchaseid = $3
    `;

    await tenantDB.query(headerSql, [
      purchase_header.purchase_date,
      user_id,
      purchase_id
    ]);

    /* 3️⃣ Delete Old Items */
    await tenantDB.query(
      `DELETE FROM stock_transaction WHERE purchase_id = $1`,
      [purchase_id]
    );

    /* 4️⃣ Re-Insert Items */
    const itemSql = `
      INSERT INTO stock_transaction
      (purchase_id, purchase_date, instoreid, outstoreid,
       itmid, itmname, unitid, stockqty, rate, value, canordersts)
      VALUES
      ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
    `;

    for (const item of purchase_items) {
      await tenantDB.query(itemSql, [
        purchase_id,
        purchase_header.purchase_date,
        item.instore_id,
        item.outstore_id,
        item.item_id,
        item.item_name,
        item.unit_id,
        item.quantity,
        item.rate,
        item.value,
        item.can_order_status
      ]);
    }

    await tenantDB.query("COMMIT");

    return {
      status: 1,
      message: "Purchase Updated Successfully",
      purchase_no,
      purchase_id
    };

  } catch (error) {
    await tenantDB.query("ROLLBACK");
    console.error("Update purchase error:", error);

    return {
      status: 0,
      message: "Purchase update failed",
      error: error.message
    };
  }
};

const cancelPurchaseItem = async (
  tenantDB,
  register_id,
  user_id,
  purchase_id,
  item_id
) => {
  try {
    await tenantDB.query("BEGIN");

    /* 1️⃣ Validate Item Exists */
    const chkSql = `
      SELECT stocktrnid
      FROM stock_transaction
      WHERE purchase_id = $1
        AND itmid = $2
        AND itmcandel = 0
    `;
    const chkRes = await tenantDB.query(chkSql, [
      purchase_id,
      item_id
    ]);

    if (chkRes.rows.length === 0) {
      throw new Error("Item not found or already cancelled");
    }

    /* 2️⃣ Soft Delete Item */
    const updSql = `
      UPDATE stock_transaction
      SET itmcandel = 1
      WHERE purchase_id = $1
        AND itmid = $2
    `;

    await tenantDB.query(updSql, [
      purchase_id,
      item_id
    ]);

    await tenantDB.query("COMMIT");

    return {
      status: 1,
      message: "Item cancelled successfully",
      purchase_id,
      item_id
    };

  } catch (error) {
    await tenantDB.query("ROLLBACK");
    console.error("Cancel item error:", error);

    return {
      status: 0,
      message: "Item cancel failed",
      error: error.message
    };
  }
};


const cancelPurchase = async (
  tenantDB,
  register_id,
  user_id,
  purchase_id
) => {
  try {
    await tenantDB.query("BEGIN");

    /* 1️⃣ Check Purchase Exists & Active */
    const chkSql = `
      SELECT purchaseid
      FROM purchase_header
      WHERE purchaseid = $1
        AND storeid = $2
        AND cansts = 0
    `;
    const chkRes = await tenantDB.query(chkSql, [
      purchase_id,
      register_id
    ]);

    if (chkRes.rows.length === 0) {
      throw new Error("Purchase not found or already cancelled");
    }

    /* 2️⃣ Cancel Purchase Header */
    const updHeaderSql = `
      UPDATE purchase_header
      SET cansts = 1,
          updated_at = $1,
          updated_datetime = CURRENT_TIMESTAMP
      WHERE purchaseid = $2
    `;
    await tenantDB.query(updHeaderSql, [
      user_id,
      purchase_id
    ]);

    /* 3️⃣ Cancel All Purchase Items */
    const updItemsSql = `
      UPDATE stock_transaction
      SET itmcandel = 1
      WHERE purchase_id = $1
        AND itmcandel = 0
    `;
    await tenantDB.query(updItemsSql, [purchase_id]);

    await tenantDB.query("COMMIT");

    return {
      status: 1,
      message: "Purchase cancelled successfully",
      purchase_id
    };

  } catch (error) {
    await tenantDB.query("ROLLBACK");
    console.error("Cancel purchase error:", error);

    return {
      status: 0,
      message: "Purchase cancel failed",
      error: error.message
    };
  }
};

export const getPurchaseList = async (
  tenantDB,
  search = "",
  fromDate = null,
  toDate = null,
  limit = 15,
  offset = 0
) => {
  try {
    let conditions = [];
    let values = [];
    let idx = 1;

    /* ---- SEARCH CONDITION ---- */
    if (search) {
      conditions.push(`
        (
          purchase_no ILIKE $${idx}
          OR COALESCE(refrence, '') ILIKE $${idx}
        )
      `);
      values.push(`%${search}%`);
      idx++;
    }

    /* ---- FROM DATE ---- */
    if (fromDate) {
      conditions.push(`DATE(purchasedate) >= $${idx}`);
      values.push(fromDate);
      idx++;
    }

    /* ---- TO DATE ---- */
    if (toDate) {
      conditions.push(`DATE(purchasedate) <= $${idx}`);
      values.push(toDate);
      idx++;
    }

    const whereClause =
      conditions.length > 0
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    /* ---- DATA QUERY ---- */
    const dataSql = `
      SELECT
        purchaseid,
        TO_CHAR(purchasedate, 'DD-MM-YYYY') AS date,
        purchase_no,
        COALESCE(refrence, '') AS refrence,
        CASE
          WHEN cansts = 1 THEN 'Cancelled'
          ELSE 'Active'
        END AS status,
        sum(st."value") as totamt
      FROM purchase_header  ph inner join stock_transaction as st on ph.purchaseid = st.purchase_id
      ${whereClause}
      group by ph.purchaseid
      ORDER BY purchaseid DESC
      LIMIT $${idx} OFFSET $${idx + 1}
    `;

    /* ---- COUNT QUERY ---- */
    const countSql = `
      SELECT COUNT(*) AS total
      FROM purchase_header
      ${whereClause}
    `;

    const dataRes = await tenantDB.query(dataSql, [
      ...values,
      limit,
      offset
    ]);

    const countRes = await tenantDB.query(countSql, values);

    return {
      status: 1,
      data: dataRes.rows,
      total: Number(countRes.rows[0].total),
    };

  } catch (err) {
    console.error("Purchase list error:", err);
    return {
      status: 0,
      message: "Failed to fetch purchase list",
      error: err.message,
    };
  }
};


export const getPurchaseById = async (tenantDB, purchaseId) => {
  /* ---- HEADER ---- */
  const headerSql = `
    SELECT
      purchaseid,
      purchasedate,
      purchase_no,
      COALESCE(refrence, '') AS refrence
    FROM purchase_header
    WHERE purchaseid = $1
  `;
  const headerRes = await tenantDB.query(headerSql, [purchaseId]);

  if (headerRes.rows.length === 0) {
    return null;
  }

  /* ---- ITEMS ---- */
  const itemSql = `
    SELECT
      st.purchase_id,
      st.itmid       AS item_id,
      st.itmname     AS item_name,
      st.unitid      AS unit_id,
      um.unitname    AS unit_name,
      st.rate,
      st.stockqty    AS quantity,
      st.value
    FROM stock_transaction st
    INNER JOIN unitofmeasure_master um 
      ON st.unitid = um.unitid
    WHERE st.purchase_id = $1 and st.itmcandel = 0
    ORDER BY st.stocktrnid
  `;
  const itemRes = await tenantDB.query(itemSql, [purchaseId]);

  return {
    purchase_id: headerRes.rows[0].purchaseid,
    purchase_no: headerRes.rows[0].purchase_no,
    purchase_date: headerRes.rows[0].purchasedate,
    reference: headerRes.rows[0].refrence,
    purchase_items: itemRes.rows,
  };
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
  singleorddetail,
  getsuperdealsmodel,
  flashsalemodel,
  getflashsale,
  submitpurchase,
  updatepurchase,
  cancelPurchaseItem,
  cancelPurchase,
  getPurchaseList,
  getPurchaseById,
  Itemslist,
};



