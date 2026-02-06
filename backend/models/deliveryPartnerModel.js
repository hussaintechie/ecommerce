

const deliveryPartnerModel = {

  // ============================
  // CREATE DRIVER
  // ============================
  createDriver: async (tenantDB, data, register_id) => {
  try {
    const check = await tenantDB.query(
      `SELECT * FROM tbl_delivery_partner WHERE mobile = $1`,
      [data.mobile]
    );

    if (check.rowCount > 0) {
      return { status: 0, message: "Driver already exists" };
    }

    const result = await tenantDB.query(
      `
      INSERT INTO tbl_delivery_partner
      (
        full_name,
        mobile,
        aadhar_no,
        address,
        status,
        register_id
      )
      VALUES ($1, $2, $3, $4, 1, $5)
      RETURNING driver_id
      `,
      [
        data.full_name,
        data.mobile,
        data.aadhar_no,
        data.address,
        register_id, // ✅ IMPORTANT
      ]
    );

    return {
      status: 1,
      message: "Driver registered successfully",
      driver_id: result.rows[0].driver_id,
    };
  } catch (error) {
    console.error("Create driver error:", error);
    return { status: 0, message: "Driver creation failed" };
  }
},


  // ============================
  // GET ALL DRIVERS
  // ============================
  getDrivers: async (tenantDB) => {
    try {
      const res = await tenantDB.query(`
        SELECT 
          driver_id,
          full_name,
          mobile,
          aadhar_no,
          address,
          status,
          created_at
        FROM tbl_delivery_partner
        ORDER BY created_at DESC
      `);

      return { status: 1, data: res.rows };
    } catch (error) {
      console.error("Fetch drivers error:", error);
      return { status: 0, message: "Failed to fetch drivers" };
    }
  },

  // ============================
  // GET SINGLE DRIVER
  // ============================
  getDriverById: async (tenantDB, driver_id) => {
    try {
      const res = await tenantDB.query(
        `SELECT * FROM tbl_delivery_partner WHERE driver_id = $1`,
        [driver_id]
      );

      if (res.rowCount === 0)
        return { status: 0, message: "Driver not found" };

      return { status: 1, data: res.rows[0] };
    } catch (error) {
      console.error("Fetch driver error:", error);
      return { status: 0, message: "Failed to fetch driver" };
    }
  },

  // ============================
  // UPDATE DRIVER
  // ============================
  updateDriver: async (tenantDB, driver_id, data) => {
    try {
      await tenantDB.query(
        `
        UPDATE tbl_delivery_partner
        SET 
          full_name = $1,
          mobile = $2,
          aadhar_no = $3,
          address = $4,
          status = $5
        WHERE driver_id = $6
        `,
        [
          data.full_name,
          data.mobile,
          data.aadhar_no,
          data.address,
          data.status,
          driver_id,
        ]
      );

      return { status: 1, message: "Driver updated successfully" };
    } catch (error) {
      console.error("Update driver error:", error);
      return { status: 0, message: "Update failed" };
    }
  },

  // ============================
  // DELETE DRIVER (OPTIONAL)
  // ============================
  deleteDriver: async (tenantDB, driver_id) => {
    try {
      await tenantDB.query(
        `DELETE FROM tbl_delivery_partner WHERE driver_id = $1`,
        [driver_id]
      );

      return { status: 1, message: "Driver deleted successfully" };
    } catch (error) {
      console.error("Delete driver error:", error);
      return { status: 0, message: "Delete failed" };
    }
  },
  

  deliveryPartnerLogin: async (tenantDB, mobile) => {
  try {
    const res = await tenantDB.query(
      `
      SELECT 
        driver_id,
        full_name,
        mobile,
        register_id
      FROM tbl_delivery_partner
      WHERE mobile = $1 AND status = 1
      `,
      [mobile]
    );

    if (res.rowCount === 0) {
      return { status: 0, message: "Driver not found" };
    }

    return {
      status: 1,
      data: res.rows[0],
    };
  } catch (err) {
    console.error("Driver login error:", err);
    return { status: 0, message: "Login failed" };
  }
},



  
};

export default deliveryPartnerModel;
 