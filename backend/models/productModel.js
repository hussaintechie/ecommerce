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
  items_details
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
        itm.product_amount AS itmamt,
        itm.product_qty AS qty,
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
        ord.order_no,
        t.name AS customer_name,
        t.phone AS customer_phone,
        ord.address_delivery AS address,
        COALESCE(pay.method, 'COD') AS pay_method,
        TO_CHAR(ord.created_at, 'DD-Mon-YYYY') AS pay_date
      FROM tbl_master_orders ord
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
        handling_fee: Number(info.handling_fee || 0),
        delivery_fee: Number(info.delivery_fee || 0),
        total_amount: Number(info.total_amount || 0),
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


const markOutForDelivery = async (tenantDB, order_id) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await tenantDB.query(
    `UPDATE tbl_master_orders
     SET order_status='OutForDelivery', delivery_otp=$1
     WHERE order_id=$2`,
    [otp, order_id]
  );

  await tenantDB.query(
    `INSERT INTO tbl_order_tracking (order_id, status, message)
     VALUES ($1, 'out_for_delivery', 'Order out for delivery')`,
    [order_id]
  );

  return { status: 1, message: "Order out for delivery", otp };
};
const verifyDeliveryOTP = async (tenantDB, order_id, otp) => {
  const res = await tenantDB.query(
    `SELECT delivery_otp FROM tbl_master_orders
     WHERE order_id=$1 AND order_status='OutForDelivery'`,
    [order_id]
  );

  if (res.rowCount === 0) {
    return { status: 0, message: "Invalid order" };
  }

  if (res.rows[0].delivery_otp !== otp) {
    return { status: 0, message: "Invalid OTP" };
  }

  await tenantDB.query(
    `UPDATE tbl_master_orders
     SET order_status='Delivered', otp_verified=true
     WHERE order_id=$1`,
    [order_id]
  );

  await tenantDB.query(
    `INSERT INTO tbl_order_tracking (order_id, status, message)
     VALUES ($1, 'delivered', 'Order delivered successfully')`,
    [order_id]
  );

  return { status: 1, message: "Order delivered successfully" };
};


const trackOrder = async (tenantDB, order_id) => {
  const res = await tenantDB.query(
    `SELECT status, message, created_at
     FROM tbl_order_tracking
     WHERE order_id=$1
     ORDER BY created_at`,
    [order_id]
  );

  return { status: 1, data: res.rows };
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
  
};
