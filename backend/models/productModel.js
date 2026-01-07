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
const unitlist = async (tenantDB, store_id,) => {
  try {

    let unitsql = `select unitid,unitname,unitshortcode from unitofmeasure_master `;

    const result = await tenantDB.query(unitsql);

    return { status: 1, message: "Unit fetched", data: result.rows };

  } catch (error) {
    console.error("Unit fetch error:", error);
    return { status: 0, message: "Fetch failed", error };
  }
};
const Optionitems = async (tenantDB, store_id,) => {
  try {

    let itmsql = `  SELECT DISTINCT ON (itm.product_id)
        itm.product_id AS item_id,
        itm.title AS item_name,
     um.unitid as unit_id,
     um.unitname as unit_name,
        itm.price as rate
      FROM tbl_master_product itm
      inner join unitofmeasure_master as um on itm.unit = um.unitid	`;

    const result = await tenantDB.query(itmsql);

    return { status: 1, message: "Item fetched", data: result.rows };

  } catch (error) {
    console.error("Item fetch error:", error);
    return { status: 0, message: "Fetch failed", error };
  }
};
const Lowstockdetails = async (
  tenantDB,
  store_id,
  page = 1,
  limit = 10,
  search = "",
  filtertyp = "low" // all | low | out
) => {
  try {
    const offset = (page - 1) * limit;
    const hasSearch = search && search.trim() !== "";

    const whereSearchData = hasSearch
      ? `AND LOWER(p.title) LIKE LOWER($3)`
      : "";

    const whereSearchCount = hasSearch
      ? `AND LOWER(p.title) LIKE LOWER($1)`
      : "";

    let whereStockFilter = "";

    if (filtertyp === "low") {

      whereStockFilter = `
        AND (
          COALESCE(p.openbalqty + COALESCE(st.current_stock,0), p.openbalqty) > 0
          AND
          COALESCE(p.openbalqty + COALESCE(st.current_stock,0), p.openbalqty)
              <= COALESCE(p.lowstqty,0)
        )
      `;
    }
    else if (filtertyp === "out") {

      whereStockFilter = `
        AND (
          COALESCE(p.openbalqty + COALESCE(st.current_stock,0), p.openbalqty) <= 0
        )
      `;
    }

    const dataSql = `
      SELECT
        p.product_id AS id,
        p.title AS name,
        p.lowstqty,
        p.itmsts,
        COALESCE(
          p.openbalqty + COALESCE(st.current_stock, 0),
          p.openbalqty
        ) AS stock,
        COALESCE(img.image_url, '') AS image
      FROM tbl_master_product p
      LEFT JOIN (
        SELECT
          itmid,
          SUM(
            CASE
              WHEN instoreid > 0 THEN stockqty
              WHEN outstoreid > 0 THEN -stockqty
              ELSE 0
            END
          ) AS current_stock
        FROM stock_transaction
        WHERE COALESCE(itmcandel, 0) = 0
          AND COALESCE(canordersts, 0) = 0
        GROUP BY itmid
      ) st ON st.itmid = p.product_id
      LEFT JOIN (
        SELECT DISTINCT ON (product_id)
          product_id,
          image_url
        FROM tbl_product_images
        ORDER BY product_id, image_url
      ) img ON img.product_id = p.product_id
      WHERE p.itmsts = 1
        ${whereSearchData}
        ${whereStockFilter}
      ORDER BY p.product_id DESC
      LIMIT $1 OFFSET $2
    `;

    const countSql = `
      SELECT COUNT(*)::int AS count
      FROM tbl_master_product p
      LEFT JOIN (
        SELECT
          itmid,
          SUM(
            CASE
              WHEN instoreid > 0 THEN stockqty
              WHEN outstoreid > 0 THEN -stockqty
              ELSE 0
            END
          ) AS current_stock
        FROM stock_transaction
        WHERE COALESCE(itmcandel, 0) = 0
          AND COALESCE(canordersts, 0) = 0
        GROUP BY itmid
      ) st ON st.itmid = p.product_id
      WHERE p.itmsts = 1
        ${whereSearchCount}
        ${whereStockFilter}
    `;

    /* ---------- VALUES ---------- */
    const dataValues = hasSearch
      ? [limit, offset, `%${search}%`]
      : [limit, offset];

    const countValues = hasSearch
      ? [`%${search}%`]
      : [];

    const dataRes = await tenantDB.query(dataSql, dataValues);
    const countRes = await tenantDB.query(countSql, countValues);

    return {
      status: 1,
      message: "Stock items fetched successfully",
      data: dataRes.rows,
      total: countRes.rows[0]?.count || 0,
      sql:dataSql,
    };

  } catch (error) {
    console.error("Low stock fetch error:", error);
    return {
      status: 0,
      message: "Fetch failed",
      error: error.message
    };
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
        itm.itmsts,
        itm.unit,
        CASE
          WHEN itm.itmsts = 1 THEN 'Active'
          ELSE 'In-Active'
        END AS status,
        itm.lowstqty,
        itm.openbalqty,
        itm.openbaldate,
        itm.discount_per,
        itm.discount_sts,
        prdimg.image_url AS image
      FROM tbl_master_product itm
      LEFT JOIN tbl_product_images prdimg 
        ON itm.product_id = prdimg.product_id
      inner join tbl_master_categories as cat on itm.categories_id = cat.categories_id		
      ${whereClause}
      ORDER BY itm.product_id
      LIMIT $${search ? 2 : 1} OFFSET $${search ? 3 : 2}
    `;

    console.log(dataSql, 'dataSql');

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
        0
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
       itmid, itmname, unitid, stockqty, rate, value)
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


const saveItem = async (tenantDB, storeid, product) => {
  let inTx = false;

  try {
    /* ---------- VALIDATION ---------- */
    if (!product?.name?.trim()) {
      return { status: 0, message: "Item name is required" };
    }

    if (!product.category && !product.categories_id) {
      return { status: 0, message: "Category is required" };
    }

    if (!product.unit) {
      return { status: 0, message: "Unit is required" };
    }

    const categoryId = product.category ?? 0;
    const price = Number(product.basePrice ?? 0);
    const mrp = Number(product.mrp ?? 0);
    const lowStockQty = Number(product.lowstqty ?? 0);
    const openBalQty = Number(product.openbalqty ?? 0);
    const openBalDate = product.openbaldate || null;
    const itemStatus = product.itmsts ?? 1;
    const dissts = product.discount_sts ?? 0;
    const disper = Number(product.discount_per ?? 0);

    /* ---------- BEGIN TRANSACTION ---------- */
    await tenantDB.query("BEGIN");
    inTx = true;

    /* ================= INSERT ================= */
    if (!product.id || Number(product.id) === 0) {

      /* ---- DUPLICATE CHECK ---- */
      const dupRes = await tenantDB.query(
        `SELECT 1 FROM tbl_master_product WHERE LOWER(title) = LOWER($1) LIMIT 1`,
        [product.name.trim()]
      );

      if (dupRes.rows.length > 0) {
        await tenantDB.query("ROLLBACK");
        return { status: 0, message: "Item name already exists" };
      }

      const insertSql = `
        INSERT INTO tbl_master_product (
          categories_id,
          title,
          description,
          price,
          mrp,
          quantity,
          unit,
          lowstqty,
          itmsts,
          openbalqty,
          openbaldate,
          discount_sts,
          discount_per,
          created_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,now()
        )
        RETURNING product_id
      `;

      const insertValues = [
        categoryId,
        product.name.trim(),
        product.description || "",
        price,
        mrp,
        0,
        product.unit,
        lowStockQty,
        itemStatus,
        openBalQty,
        openBalDate,
        dissts,
        disper
      ];

      const result = await tenantDB.query(insertSql, insertValues);
      const productId = result.rows[0].product_id;

      if (product.image) {
        await tenantDB.query(
          `INSERT INTO tbl_product_images (product_id, image_url)
           VALUES ($1, $2)`,
          [productId, product.image]
        );
      }

      await tenantDB.query("COMMIT");

      return {
        status: 1,
        message: "Item inserted successfully",
        product_id: productId
      };
    }

    /* ================= UPDATE ================= */
    const updateSql = `
      UPDATE tbl_master_product
      SET
        categories_id = $1,
        title = $2,
        description = $3,
        price = $4,
        mrp = $5,
        unit = $6,
        lowstqty = $7,
        itmsts = $8,
        openbalqty = $9,
        openbaldate = $10,
        discount_sts = $11,
        discount_per = $12
      WHERE product_id = $13
    `;

    const updateValues = [
      categoryId,
      product.name.trim(),
      product.description || "",
      price,
      mrp,
      product.unit,
      lowStockQty,
      itemStatus,
      openBalQty,
      openBalDate,
      dissts,
      disper,
      product.id
    ];

    const updateRes = await tenantDB.query(updateSql, updateValues);

    if (updateRes.rowCount === 0) {
      throw new Error("Product not found");
    }

    if (product.image) {
      await tenantDB.query(
        `DELETE FROM tbl_product_images WHERE product_id = $1`,
        [product.id]
      );

      await tenantDB.query(
        `INSERT INTO tbl_product_images (product_id, image_url)
         VALUES ($1, $2)`,
        [product.id, product.image]
      );
    }

    await tenantDB.query("COMMIT");

    return {
      status: 1,
      message: "Item updated successfully"
    };

  } catch (error) {
    if (inTx) await tenantDB.query("ROLLBACK");

    console.error("Item save error:", error);

    return {
      status: 0,
      message: error.message || "Item save failed"
    };
  }
};
const getDashboardDatas = async (tenantDB, chartmode, date) => {
  let chartsql = "";

  try {
    /* ---------------- CHART QUERY (RAW) ---------------- */

    if (chartmode === "Week") {
      chartsql = `
        SELECT
          TO_CHAR(created_at::date, 'Dy') AS name,
          SUM(total_amount)::numeric(10,2) AS sales
        FROM tbl_master_orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
          AND created_at < CURRENT_DATE + INTERVAL '1 day'
          AND payment_status = 'complete'
          AND order_status != 'cancelled'
        GROUP BY created_at::date
        ORDER BY created_at::date;
      `;

    }

    else if (chartmode === "Month") {
      chartsql = `
        SELECT
          'Week ' || (
            FLOOR((EXTRACT(DAY FROM created_at) - 1) / 7) + 1
          ) AS name,
          SUM(total_amount)::numeric(10,2) AS sales
        FROM tbl_master_orders
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
          AND created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
          AND payment_status = 'complete'
          AND order_status != 'cancelled'
        GROUP BY name
        ORDER BY name;
      `;
    }

    else if (chartmode === "Year") {
      chartsql = `
        SELECT
          TO_CHAR(created_at, 'Mon') AS name,
          SUM(total_amount)::numeric(10,2) AS sales
        FROM tbl_master_orders
        WHERE created_at >= DATE_TRUNC('year', CURRENT_DATE)
          AND created_at < DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year'
          AND payment_status = 'complete'
          AND order_status != 'cancelled'
        GROUP BY DATE_TRUNC('month', created_at), TO_CHAR(created_at, 'Mon')
        ORDER BY DATE_TRUNC('month', created_at);
      `;
    }

    /* ---------------- SUMMARY (TODAY vs YESTERDAY) ---------------- */

    const summarysql = `
      SELECT
        /* TODAY */
        COUNT(*) FILTER (
          WHERE created_at >= '${date}'::date
            AND created_at <  '${date}'::date + INTERVAL '1 day'
            AND order_status != 'cancelled'
        ) AS today_orders,

        SUM(total_amount) FILTER (
          WHERE created_at >= '${date}'::date
            AND created_at <  '${date}'::date + INTERVAL '1 day'
            AND payment_status = 'complete'
            AND order_status != 'cancelled'
        ) AS today_revenue,

        COUNT(*) FILTER (
          WHERE created_at >= '${date}'::date
            AND created_at <  '${date}'::date + INTERVAL '1 day'
            AND order_status = 'Pending'
        ) AS today_pending,

        /* YESTERDAY */
        COUNT(*) FILTER (
          WHERE created_at >= '${date}'::date - INTERVAL '1 day'
            AND created_at <  '${date}'::date
            AND order_status != 'cancelled'
        ) AS yesterday_orders,

        SUM(total_amount) FILTER (
          WHERE created_at >= '${date}'::date - INTERVAL '1 day'
            AND created_at <  '${date}'::date
            AND payment_status = 'complete'
            AND order_status != 'cancelled'
        ) AS yesterday_revenue,

        COUNT(*) FILTER (
          WHERE created_at >= '${date}'::date - INTERVAL '1 day'
            AND created_at <  '${date}'::date
            AND order_status = 'Pending'
        ) AS yesterday_pending
      FROM tbl_master_orders;
    `;

    /* ---------------- LOW STOCK ---------------- */

    const lowstocksql = `
       SELECT
        p.product_id AS id,
        p.title AS name,
        p.lowstqty,
        p.itmsts,
        COALESCE(
          p.openbalqty + COALESCE(st.current_stock, 0),
          p.openbalqty
        ) AS stock,
        COALESCE(img.image_url, '') AS image
      FROM tbl_master_product p
      LEFT JOIN (
        SELECT
          itmid,
          SUM(
            CASE
              WHEN instoreid > 0 THEN stockqty
              WHEN outstoreid > 0 THEN -stockqty
              ELSE 0
            END
          ) AS current_stock
        FROM stock_transaction
        WHERE COALESCE(itmcandel, 0) = 0
          AND COALESCE(canordersts, 0) = 0
        GROUP BY itmid
      ) st ON st.itmid = p.product_id
      LEFT JOIN (
        SELECT DISTINCT ON (product_id)
          product_id,
          image_url
        FROM tbl_product_images
        ORDER BY product_id, image_url
      ) img ON img.product_id = p.product_id
      WHERE p.itmsts = 1
        AND (
          COALESCE(p.openbalqty + COALESCE(st.current_stock,0), p.openbalqty) > 0
          AND
          COALESCE(p.openbalqty + COALESCE(st.current_stock,0), p.openbalqty)
              <= COALESCE(p.lowstqty,0)
        )
      ORDER BY COALESCE(st.current_stock,0) DESC limit 5
    `;

    /* ---------------- EXECUTION ---------------- */

    const chartres = chartsql ? await tenantDB.query(chartsql) : { rows: [] };
    const summaryres = await tenantDB.query(summarysql);
    const lowstockres = await tenantDB.query(lowstocksql);

    return {
      status: 1,
      message: "DashboardDatas fetched",
      data: {
        chartres: chartres.rows,
        summary: summaryres.rows[0],
        lowstockdetailsres: lowstockres.rows,

        // 👇 RAW SQL FOR DEBUGGING
        // debug_sql: {
        //   chartsql,
        //   summarysql,
        //   lowstocksql
        // }
      }
    };

  } catch (error) {
    console.error("DashboardDatas fetch error:", error);
    return {
      status: 0,
      message: "DashboardDatas Fetch failed",
      error
    };
  }
};


const WEEK_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
];

const MONTH_WEEK_LABELS = [
  'Week 1', 'Week 2', 'Week 3', 'Week 4', 'Week 5'
];


const toSalesMap = (rows) => {
  const map = {};
  rows.forEach(r => {
    map[r.name] = Number(r.sales || 0);
  });
  return map;
};


const buildWeekData = (rows) => {
  const map = toSalesMap(rows);
  return WEEK_LABELS.map(day => ({
    name: day,
    sales: map[day] || 0
  }));
};

const buildMonthData = (rows) => {
  const map = toSalesMap(rows);
  return MONTH_WEEK_LABELS.map(week => ({
    name: week,
    sales: map[week] || 0
  }));
};

const buildYearData = (rows) => {
  const map = toSalesMap(rows);
  return MONTH_LABELS.map(month => ({
    name: month,
    sales: map[month] || 0
  }));
};

const getChartdetails = async (tenantDB, chartmode) => {
  let chartsql = "";

  try {
    /* ---------------- WEEK ---------------- */
    if (chartmode === "Week") {
      chartsql = `
        SELECT
          TO_CHAR(created_at::date, 'Dy') AS name,
          SUM(total_amount)::numeric(10,2) AS sales
        FROM tbl_master_orders
        WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
          AND created_at < CURRENT_DATE + INTERVAL '1 day'
          AND payment_status = 'complete'
          AND order_status != 'cancelled'
        GROUP BY created_at::date
        ORDER BY created_at::date;
      `;
    }

    /* ---------------- MONTH ---------------- */
    else if (chartmode === "Month") {
      chartsql = `
        SELECT
          'Week ' || (FLOOR((EXTRACT(DAY FROM created_at) - 1) / 7) + 1) AS name,
          SUM(total_amount)::numeric(10,2) AS sales
        FROM tbl_master_orders
        WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
          AND created_at < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
          AND payment_status = 'complete'
          AND order_status != 'cancelled'
        GROUP BY name
        ORDER BY name;
      `;
    }

    /* ---------------- YEAR ---------------- */
    else if (chartmode === "Year") {
      chartsql = `
        SELECT
          TO_CHAR(created_at, 'Mon') AS name,
          SUM(total_amount)::numeric(10,2) AS sales
        FROM tbl_master_orders
        WHERE created_at >= DATE_TRUNC('year', CURRENT_DATE)
          AND created_at < DATE_TRUNC('year', CURRENT_DATE) + INTERVAL '1 year'
          AND payment_status = 'complete'
          AND order_status != 'cancelled'
        GROUP BY DATE_TRUNC('month', created_at), TO_CHAR(created_at, 'Mon')
        ORDER BY DATE_TRUNC('month', created_at);
      `;
    }

    /* ---------------- EXECUTE QUERY ---------------- */
    const chartres = chartsql
      ? await tenantDB.query(chartsql)
      : { rows: [] };

    /* ---------------- NORMALIZE DATA ---------------- */
    let finalChartData = [];

    if (chartmode === "Week") {
      finalChartData = buildWeekData(chartres.rows);
    }
    else if (chartmode === "Month") {
      finalChartData = buildMonthData(chartres.rows);
    }
    else if (chartmode === "Year") {
      finalChartData = buildYearData(chartres.rows);
    }

    /* ---------------- RESPONSE ---------------- */
    return {
      status: 1,
      message: "Chart data fetched",
      data: finalChartData
    };

  } catch (error) {
    console.error("Chart fetch error:", error);
    return {
      status: 0,
      message: "Chart fetch failed",
      error
    };
  }
};

// productmodel.js
const orderdataget = async (tenantDB, store_id, limit, offset, searchtxt) => {
  try {
    const dataSql = `
     SELECT 
  r.order_id,
  r.order_no,
  r.total_amount,
  r.order_status,
  r.payment_status,
  d.delivery_mode,
  r.delivery_start,
  r.delivery_end,
  t.name,

  -- ✅ ITEM COUNT
 COALESCE(SUM(i.product_qty), 0) AS item_count

  

FROM tbl_master_orders r

INNER JOIN tbl_delivery_modes d 
  ON r.delivery_id = d.delivery_id

INNER JOIN tbl_address t 
  ON t.user_id = r.user_id

LEFT JOIN tbl_master_order_items i 
  ON i.order_id = r.order_id

GROUP BY
  r.order_id,
  r.order_no,
  r.total_amount,
  r.order_status,
  r.payment_status,
  d.delivery_mode,
  r.delivery_start,
  r.delivery_end,
  t.name,
  r.created_at

ORDER BY r.created_at DESC
LIMIT $1 OFFSET $2;

    `;

    const countSql = `SELECT COUNT(*) FROM tbl_master_orders`;

    const [dataRes, countRes] = await Promise.all([
      tenantDB.query(dataSql, [limit, offset]),
      tenantDB.query(countSql)
    ]);

    return {
      status: 1,
      data: dataRes.rows,
      total: Number(countRes.rows[0].count)
    };
  } catch (error) {
    console.error("Order fetch error:", error);
    return { status: 0, message: "Fetch failed" };
  }
};
const ordersubmit = async (
  tenantDB,
  user_id,
  address_delivery,
  total_amount,
  handling_fee,
  delivery_fee,
  delivery_start,
  delivery_end,
  order_status,
  delivery_id,
  payment_status,
  payment_method,          // ✅ ADD
  razorpay_payment_id,     // ✅ ADD
  razorpay_order_id,       // ✅ ADD
  razorpay_signature, 
  items_details,
  coupon_code = null,
  coupon_discount = 0,
  first_order_discount = 0,
  coupon_id = null

) => {
  try {
    await tenantDB.query("BEGIN");

    /* --------- ROLL NUMBER --------- */
    const rollnores = await tenantDB.query(
      `SELECT * FROM tbl_rollno_master WHERE rollid = 1 FOR UPDATE`
    );

    const prefix = rollnores.rows[0]?.prefix ?? "ORD";
    const lastId = rollnores.rows[0]?.lastrollid ?? 0;
    const nodigit = rollnores.rows[0]?.nodigit ?? 4;

    const order_no = `${prefix}${String(lastId + 1).padStart(nodigit, "0")}`;
    

// mark coupon used



    /* --------- INSERT ORDER --------- */
   const orderRes = await tenantDB.query(
  `
  INSERT INTO tbl_master_orders
  (
    order_no,
    user_id,
    address_delivery,
    total_amount,
    handling_fee,
    delivery_fee,
    delivery_start,
    delivery_end,
    order_status,
    delivery_id,
    payment_status
  )
  VALUES (
    $1, $2, $3, $4, $5,
    $6,
    $7::timestamp,
    $8::timestamp,
    $9, $10, $11
  )
  RETURNING order_id
  `,
  [
    order_no,          // $1
    user_id,           // $2
    address_delivery,  // $3
    total_amount,      // $4
    handling_fee,      // $5
    delivery_fee,      // $6 ✅ number
    delivery_start,    // $7 ✅ timestamp
    delivery_end,      // $8 ✅ timestamp
    order_status,      // $9
    delivery_id,       // $10
    payment_status,    // $11
  ]
);

    const order_id = orderRes.rows[0].order_id;
    await tenantDB.query(
  `
  UPDATE tbl_master_orders
  SET coupon_code = $1,
      coupon_discount = $2,
      first_order_discount = $3
  WHERE order_id = $4
  `,
  [
    coupon_code,
    coupon_discount,
    first_order_discount,
    order_id
  ]
);

// =====================
// MARK COUPON USED
// =====================
console.log("Coupon Data:", {
  coupon_id,
  coupon_code,
  coupon_discount
});

let final_coupon_id = null;

if (coupon_code) {
  const res = await tenantDB.query(
    `SELECT coupon_id FROM tbl_coupons WHERE coupon_code = $1`,
    [coupon_code]
  );

  if (res.rowCount > 0) {
    final_coupon_id = res.rows[0].coupon_id;
  }
}

if (final_coupon_id) {
  await tenantDB.query(
    `INSERT INTO tbl_coupon_usage (coupon_id, user_id, order_id)
     VALUES ($1, $2, $3)`,
    [final_coupon_id, user_id, order_id]
  );
}


    /* --------- UPDATE ROLL --------- */
    await tenantDB.query(
      `UPDATE tbl_rollno_master SET lastrollid = lastrollid + 1 WHERE rollid = 1`
    );

    /* --------- INSERT ITEMS --------- */
    for (const item of items_details) {
      await tenantDB.query(
        `
        INSERT INTO tbl_master_order_items
        (
          order_id,
          product_id,
          product_name,
          product_unit,
          product_qty,
          product_rate,
          product_amount,
          discount_amt,
          discount_per
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        `,
        [
          order_id,
          item.product_id,
          item.product_name,
          item.product_unit,
          item.product_qty,
          item.product_rate,
          item.product_amount,
          item.discount_amt || 0,
          item.discount_per || 0,
        ]
      );
    }
   // PAYMENT STATUS FOR DB
const paymentDbStatus =
  payment_method === "COD" ? "PENDING" : "SUCCESS";

// INSERT PAYMENT
await tenantDB.query(
  `
  INSERT INTO tbl_master_payment
  (
    order_id,
    method,
    status,
    transaction_id,
    external_payment_id
  )
  VALUES ($1,$2,$3,$4,$5)
  `,
  [
    order_id,
    payment_method === "COD" ? "COD" : payment_method,
    paymentDbStatus,
    razorpay_payment_id || null,     // ✅ transaction_id
    razorpay_order_id || null        // ✅ external_payment_id
  ]
);

    /* --------- ORDER TRACKING --------- */
    await tenantDB.query(
      `
      INSERT INTO tbl_order_tracking (order_id, status, message)
      VALUES ($1, 'pending', 'Order placed successfully')
      `,
      [order_id]
    );

    await tenantDB.query("COMMIT");

    return {
      status: 1,
      message: "Order Saved Successfully",
      order_no,
      order_id,
    };

  } catch (error) {
    await tenantDB.query("ROLLBACK");
    console.error("Order save error:", error);
    return { status: 0, message: "Order save failed" };
  }
};
const getuserorders = async (tenantDB, store_id, userid) => {
  try {
    const userordersql = `
      SELECT 
        o.*,
        COALESCE(SUM(i.product_qty), 0) AS item_count
      FROM tbl_master_orders o
      LEFT JOIN tbl_master_order_items i
        ON o.order_id = i.order_id
      WHERE o.user_id = $1
      GROUP BY o.order_id
      ORDER BY o.created_at DESC
    `;

    const result = await tenantDB.query(userordersql, [userid]);
    console.log(result.rows);

    let data = {
      processed: [],
      delivered: [],
      cancelled: [],
    };

    for (const item of result.rows) {
      if (item.order_status === "Process" || item.order_status === "Pending") { 
        data.processed.push(item);
      } else if (item.order_status === "delivered") { 
        data.delivered.push(item);
      } else if (item.order_status === "cancelled") {
        data.cancelled.push(item);
      }
    }

    return {
      status: 1,
      message: "User orders fetched successfully",
      data,
    };
  } catch (error) {
    console.error("Items fetch error:", error);
    return { status: 0, message: "Items Fetch failed", error };
  }
};
const singleorddetail = async (tenantDB, store_id, orderid) => {
  try {
    /* ---------------- ITEMS ---------------- */
    const userorderitmsql = `
      SELECT 
  itm.product_name AS itmname, 
  itm.product_rate AS price,
  itm.product_qty AS qty,
  itm.product_amount AS total,
  um.unitname AS unit
FROM tbl_master_order_items itm
INNER JOIN unitofmeasure_master um  
  ON itm.product_unit = um.unitid
WHERE itm.order_id = $1

    `;

    /* ---------------- ORDER DETAILS ---------------- */
    const orderothrsql = `
     SELECT
  ord.total_amount,
  ord.handling_fee,
  ord.delivery_fee,
  ord.coupon_discount AS discount_amount,
  ord.coupon_code,
  ord.order_no,
  t.name AS customer_name,
  t.phone AS customer_phone,
  ord.address_delivery AS address,
  COALESCE(pay.method, 'COD') AS pay_method,
  TO_CHAR(ord.created_at, 'DD-Mon-YYYY') AS pay_date,
  SUM(itm.product_amount) AS item_total
FROM tbl_master_orders ord
INNER JOIN tbl_master_order_items itm 
  ON itm.order_id = ord.order_id
LEFT JOIN tbl_master_payment pay 
  ON pay.order_id = ord.order_id
INNER JOIN tbl_address t 
  ON t.address_id = (
    SELECT address_id
    FROM tbl_address
    WHERE user_id = ord.user_id
    ORDER BY address_id DESC
    LIMIT 1
  )
WHERE ord.order_id = $1
GROUP BY 
  ord.order_id, t.name, t.phone, pay.method;


    `;

    const [itmresult, otherresult] = await Promise.all([
      tenantDB.query(userorderitmsql, [orderid]),
      tenantDB.query(orderothrsql, [orderid]),
    ]);

    if (otherresult.rows.length === 0) {
      return { status: 0, message: "Order not found" };
    }

    const info = otherresult.rows[0];

    const data = {
      order_no: info.order_no,
      itmdetails: itmresult.rows,
      address: info.address,
      customer: {
        name: info.customer_name,
        phone: info.customer_phone,
      },
     billdetails: {
  item_total: Number(info.item_total || 0),
  handling_fee: Number(info.handling_fee || 0),
  delivery_fee: Number(info.delivery_fee || 0),
  discount: Number(info.discount_amount || 0),
  total_amount: Number(info.total_amount || 0),
  coupon_code: info.coupon_code || null
},

      paydetails: {
        pay_mode: info.pay_method,
        pay_date: info.pay_date,
      },
    };

    console.log("✅ SINGLE ORDER RESPONSE:", data);

    return {
      status: 1,
      message: "Order details fetched successfully",
      data,
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
  allcatedetails,
  catitems,
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
  unitlist,
  saveItem,
  Optionitems,
  Lowstockdetails,
  getDashboardDatas,
  getChartdetails,
  getuserorders,
  singleorddetail,
  orderdataget,
  ordersubmit,
};
