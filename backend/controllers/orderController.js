import pool from "../config/masterDB.js";
import { getTenantPool } from "../config/tenantDB.js";
import OrderModel from "../models/OrderModel.js"
import { io } from "../server.js";
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
    const userorderres = await OrderModel.getuserorders(tenantDB,register_id ,userid);

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
    const userorderres = await OrderModel.singleorddetail(tenantDB,register_id ,orderid,req.user );

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


export const submitorder = async (req, res) => {
  let tenantDB;

  try {
    const {
      address_delivery,
      total_amount,
      handling_fee,
      delivery_fee,
      order_status,
      delivery_id,
      payment_status,
      payment_method,
      razorpay_payment_id,
      razorpay_order_id,
      razorpay_signature,
      items_details,
      delivery_start,   // ✅ already local string
      delivery_end
    } = req.body;

    if (
  !address_delivery ||
  address_delivery === "" ||
  address_delivery === 0
) {
  return res.status(400).json({
    status: 0,
    message: "Please add or select a delivery address before placing order",
  });
}


    if (!delivery_start) {
      return res.json({ status: 0, message: "Delivery time required" });
    }

    const register_id = req.user.register_id;
    const user_id = req.user.user_id;

    const t = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [register_id]
    );

    tenantDB = getTenantPool(t.rows[0].db_name);
    if (delivery_start == "Immediate") {
  return res.status(400).json({
    status: 0,
    message: "Delivery end time missing",
  });
}

    const orderdatares = await OrderModel.ordersubmit(
      tenantDB,
      user_id,
      address_delivery,
      total_amount,
      handling_fee,
      delivery_fee,
      delivery_start,   // ✅ STORE AS-IS
      delivery_end,
      order_status,
      delivery_id,
      payment_status,
      payment_method,          // ✅
  razorpay_payment_id,     // ✅
  razorpay_order_id,       // ✅
  razorpay_signature,  
      items_details,
       req.body.coupon_code,
  req.body.coupon_discount,
  req.body.first_order_discount,
  req.body.coupon_id
    );

// 🔔 REAL-TIME NOTIFICATION

    if (!orderdatares || orderdatares.status !== 1) {
      return res.status(500).json({ status: 0, message:err.message });
    }
   io.emit("new-order", {
  order_id: orderdatares.order_id,
  register_id,
  total_amount
});

    return res.status(200).json({
      status: 1,
      message: "Order submitted successfully",
      order_id: orderdatares.order_id,
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: 0, message: "Server Error" });
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
    const orderdatares = await OrderModel.orderdataget(
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
export const customerOrderList = async (req, res) => {
  try {
    const { limit = 10, page = 1 } = req.body;
    const register_id = req.user.register_id;

    if (!register_id) {
      return res.status(400).json({
        status: 0,
        message: "Store ID required",
      });
    }

    const offset = (page - 1) * limit;

    // 🔹 Get tenant DB name
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

    // 🔹 Create tenant DB connection
    const tenantDB = getTenantPool(result.rows[0].db_name);

    // ✅ CALL MODEL WITH VALID tenantDB
    const data = await OrderModel.getCustomerOrders(
      tenantDB,
      Number(limit),
      Number(offset)
    );

    return res.json({
      status: 1,
      message: "Customer orders fetched successfully",
      data: data.rows,
      total: data.total,
    });

  } catch (error) {
    console.error("Customer order list error:", error);
    return res.status(500).json({
      status: 0,
      message:error.message,
    });
  }
};
