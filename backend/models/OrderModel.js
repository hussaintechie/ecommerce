const getISTDateTime = () => {
  return new Date()
    .toLocaleString("sv-SE", { timeZone: "Asia/Kolkata" })
    .replace("T", " ");
};
const getuserorders = async (tenantDB, store_id, userid) => {
  try {
    const userordersql = `
      SELECT 
        o.*,
        a.name,
        COALESCE(SUM(i.product_qty), 0) AS item_count
      FROM tbl_master_orders o
      LEFT JOIN tbl_master_order_items i
        ON o.order_id = i.order_id
        left join tbl_address a
        on o.user_id = a.user_id
      WHERE o.user_id = $1
      GROUP BY o.order_id,a.name
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
      const status = item.order_status?.toLowerCase();

      if (
        status === "pending" || status === "process" ||
        status === "pending" ||
        status === "out_for_delivery"
      ) {
        data.processed.push(item);
      } else if (status === "delivered") {
        data.delivered.push(item);
      } else if (status === "cancelled") {
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
const singleorddetail = async (tenantDB, store_id, orderid, user) => {
  try {

    const isDeliveryPartner = user?.role === "delivery_partner";

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
        ord.order_id,
        ord.order_status,
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
      ${isDeliveryPartner ? "AND ord.order_status = 'out_for_delivery'" : ""}
      GROUP BY 
        ord.order_id, t.name, t.phone, pay.method
    `;

    const [itmresult, otherresult] = await Promise.all([
      tenantDB.query(userorderitmsql, [orderid]),
      tenantDB.query(orderothrsql, [orderid]),
    ]);

    if (!otherresult.rows.length) {
      return {
        status: 0,
        message: isDeliveryPartner
          ? "Order not available for delivery"
          : "Order not found",
      };
    }

    const info = otherresult.rows[0];

    return {
      status: 1,
      message: "Order details fetched successfully",
      data: {
        order_id: orderid,
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
          coupon_code: info.coupon_code || null,
        },
        paydetails: {
          pay_mode: info.pay_method,
          pay_date: info.pay_date,
        },
      },
    };
  } catch (error) {
    console.error("Order fetch error:", error);
    return { status: 0, message: "Order Fetch failed" };
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
  payment_method, // ✅ ADD
  razorpay_payment_id, // ✅ ADD
  razorpay_order_id, // ✅ ADD
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
    $7,
    $8,
$9, $10, $11
  )
  RETURNING order_id
  `,
      [
        order_no, // $1
        user_id, // $2
        address_delivery, // $3
        total_amount, // $4
        handling_fee, // $5
        delivery_fee, // $6 ✅ number
        delivery_start, // $7 ✅ timestamp
        delivery_end, // $8 ✅ timestamp
        order_status, // $9
        delivery_id, // $10
        payment_status, // $11
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
      [coupon_code, coupon_discount, first_order_discount, order_id]
    );

    // =====================
    // MARK COUPON USED
    // =====================
    console.log("Coupon Data:", {
      coupon_id,
      coupon_code,
      coupon_discount,
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

     // ✅ Get current date in YYYY-MM-DD (local timezone – India safe)
const today = new Date().toLocaleDateString('en-CA');

await tenantDB.query(
  `
  INSERT INTO stock_transaction
  (
    purchase_id,
    purchase_date,
    orderid,
    instoreid,
    outstoreid,
    itmid,
    itmname,
    unitid,
    stockqty,
    rate,
    value,
    currentstock
  )
  VALUES
  ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
  `,
  [
    0,                    
    today,                
    order_id,             
    0,                   
    2,                   
    item.product_id,      
    item.product_name,    
    item.product_unit,    
    item.product_qty,     
    item.product_rate,    
    item.product_amount,  
    item.product_qty      
  ]
);

    }
    // PAYMENT STATUS FOR DB
    const paymentDbStatus = payment_method === "COD" ? "PENDING" : "complete";

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
        razorpay_payment_id || null, // ✅ transaction_id
        razorpay_order_id || null, // ✅ external_payment_id
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
  t.name,
 TO_CHAR(
  r.delivery_start,
  'YYYY-MM-DD HH24:MI:SS'
) AS delivery_start,
TO_CHAR(
  r.delivery_end,
  'YYYY-MM-DD HH24:MI:SS'
) AS delivery_end,


  -- ✅ ITEM COUNT
 COALESCE(SUM(i.product_qty), 0) AS item_count

  

FROM tbl_master_orders r

INNER JOIN tbl_delivery_modes d 
  ON r.delivery_id = d.delivery_id

LEFT JOIN (
  SELECT DISTINCT ON (user_id)
    user_id,
    name,
    city,
    street,
    landmark,
    pincode
  FROM tbl_address
  ORDER BY user_id, address_id DESC
) t ON t.user_id = r.user_id
   -- ✅ FIXED

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
      tenantDB.query(countSql),
    ]);

    return {
      status: 1,
      data: dataRes.rows,
      total: Number(countRes.rows[0].count),
    };
  } catch (error) {
    console.error("Order fetch error:", error);
    return { status: 0, message: "Fetch failed" };
  }
};
const getCustomerOrders = async (tenantDB, limit, offset) => {
  const sql = `
    SELECT 
      o.order_id,
      o.order_no,
      o.total_amount,
      o.order_status,
      o.payment_status,
      r.rating,
      o.created_at,
      a.name AS customer_name,
      COALESCE(SUM(i.product_qty), 0) AS item_count
    FROM tbl_master_orders o
    LEFT JOIN tbl_master_order_items i 
      ON o.order_id = i.order_id
   LEFT JOIN (
      SELECT DISTINCT ON (user_id)
        user_id,
        name
      FROM tbl_address
      ORDER BY user_id, address_id DESC
    ) a ON a.user_id = o.user_id

    LEFT JOIN tbl_customer_review r
      ON o.user_id = r.user_id
    GROUP BY 
      o.order_id,
      o.order_no,
      o.total_amount,
      o.order_status,
      o.payment_status,
      o.created_at,
      a.name,
      r.rating
    ORDER BY o.created_at DESC
    LIMIT $1 OFFSET $2
  `;

  const countSql = `SELECT COUNT(*) FROM tbl_master_orders`;

  const [dataRes, countRes] = await Promise.all([
    tenantDB.query(sql, [limit, offset]),
    tenantDB.query(countSql),
  ]);

  return {
    rows: dataRes.rows,
    total: Number(countRes.rows[0].count),
  };
};


export default {
  getuserorders,
  singleorddetail,
  orderdataget,
  ordersubmit,
  getCustomerOrders,
};
