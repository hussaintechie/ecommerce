export const markOutForDeliveryModel = async (tenantDB, order_id) => {
  await tenantDB.query(
    `
    UPDATE tbl_master_orders
    SET order_status = 'out_for_delivery' 
    WHERE order_id = $1
    `,
    [order_id]
  );

  await tenantDB.query(
    `
    INSERT INTO tbl_order_tracking (order_id, status)
    VALUES ($1, 'out_for_delivery')
    `,
    [order_id]
  );

  return { status: 1, message: "Order marked out for delivery" };
};

export const generateDeliveryOTPModel = async (tenantDB, order_id) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  await tenantDB.query(
    `
    UPDATE tbl_master_orders
    SET delivery_otp = $1,
        otp_generated_at = NOW()
    WHERE order_id = $2
      AND order_status = 'out_for_delivery'
    `,
    [otp, order_id]
  );

  // 🔔 SEND OTP TO USER HERE (SMS / APP)
  // sendOTP(user_phone, otp)

  return {
    status: 1,
    message: "OTP generated and sent to user",
  };
};
export const verifyDeliveryOTPModel = async (tenantDB, order_id, otp) => {
  const res = await tenantDB.query(
    `
    SELECT delivery_otp
    FROM tbl_master_orders
    WHERE order_id = $1
      AND order_status = 'out_for_delivery'
    `,
    [order_id]
  );

  if (res.rowCount === 0) {
    return { status: 0, message: "Invalid order or status" };
  }

  if (res.rows[0].delivery_otp !== otp) {
    return { status: 0, message: "Invalid OTP" };
  }

  await tenantDB.query(
    `
    UPDATE tbl_master_orders
    SET order_status = 'delivered',
        otp_verified = true,
        delivery_otp = NULL
    WHERE order_id = $1
    `,
    [order_id]
  );

  await tenantDB.query(
    `
    INSERT INTO tbl_order_tracking (order_id, status)
    VALUES ($1, 'delivered')
    `,
    [order_id]
  );

  return { status: 1, message: "Order delivered successfully" };
};

export const trackOrderModel = async (tenantDB, order_id) => {
  const res = await tenantDB.query(
    `
    SELECT LOWER(status) AS status, created_at
    FROM tbl_order_tracking
    WHERE order_id = $1
    ORDER BY created_at
    `,
    [order_id]
  );

  return { status: 1, data: res.rows };
};


export const markcancelModel = async (tenantDB, order_id) => {
  await tenantDB.query(
    `
    UPDATE tbl_master_orders
    SET order_status = 'cancelled' 
    WHERE order_id = $1
    `,
    [order_id]
  );
  await tenantDB.query(
    `update stock_transaction set canordersts =1 where  orderid = $1`,
    [order_id]
  );


  return { status: 1, message: "Order have be cancelled" };
};
