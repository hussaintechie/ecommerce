import pool from "../config/masterDB.js";
import { getTenantPool } from "../config/tenantDB.js";

export const AddressModel = {

  getTenantDB: async (store_id) => {
    const db = await pool.query(
      "SELECT db_name FROM tbl_tenant_databases WHERE register_id=$1",
      [store_id]
    );

    if (db.rows.length === 0) throw new Error("Invalid store");

    return getTenantPool(db.rows[0].db_name);
  },


  addAddress: async (tenantPool, data) => {
    const {
      user_id,
      store_id,
      address_type,
      name,
      phone,
      pincode,
      city,
      street,
      Building,
      landmark,
      lat,
      lng,
      is_default,
      full_address,

    } = data;

    const res = await tenantPool.query(
      `INSERT INTO tbl_address (
        user_id,store_id, address_type, name, phone,
        pincode,  city,
        street, Building,landmark, lat, lng, full_address,
is_default,
        created_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,NOW())
      RETURNING address_id`,
      [
        user_id,
        store_id,
        address_type,
        name,
        phone,
        pincode,
        city,
        street,
        Building,
        landmark,
        lat,
        lng,
        full_address,

        is_default,
      ]
    );

    return res.rows[0].address_id;
  },


  editAddress: async (tenantPool, address_id, data) => {
    const allowed = [
      "address_type", "name", "phone", "pincode",
      "state",  "street","Building",
      "landmark", "lat", "lng","full_address",
 "is_default"
    ];

    const fields = [];
    const values = [];

    let index = 1;

    for (const key of allowed) {
      if (data[key] !== undefined) {
        fields.push(`${key}=$${index}`);
        values.push(data[key]);
        index++;
      }
    }

    if (fields.length === 0) return;

    values.push(address_id);

    await tenantPool.query(
      `UPDATE tbl_address SET ${fields.join(", ")} WHERE address_id=$${index}`,
      values
    );
  },


  deleteAddress: async (tenantPool, address_id) => {
    await tenantPool.query("DELETE FROM tbl_address WHERE address_id=$1", [
      address_id,
    ]);
  },


  listAddresses: async (tenantPool, user_id) => {
    const res = await tenantPool.query(
      `SELECT * FROM tbl_address
       WHERE user_id=$1
       ORDER BY is_default DESC, created_at DESC`,
      [user_id]
    );
    return res.rows;
  },


  getAddressDetails: async (tenantPool, address_id) => {
    const res = await tenantPool.query(
      `SELECT * FROM tbl_address WHERE address_id=$1`,
      [address_id]
    );
    return res.rows[0];
  },
};
