import { AddressModel } from"../models/addressModel_user.js"

export const getProfile = async (req, res) => {
  try {
     console.log("REQ.USER ===>", req.user);  // ADD THIS
    const  store_id  = req.user.register_id;
    const user_id = req.user.user_id;

    const tenantPool = await AddressModel.getTenantDB(store_id);

    // fetch default address
    const result = await tenantPool.query(
      `SELECT address_id, name, phone 
       FROM tbl_address
       WHERE user_id=$1
       LIMIT 1`,
      [user_id]
    );

    if (result.rows.length === 0) {
      return res.json({
        name: "",
        phone: "",
        address_id: null
      });
    }

    res.json(result.rows[0]);

  } catch (err) {
    console.log(err)
    res.status(500).json({ message: "Something went wrong" });
  }
};

export const updateProfile = async (req, res) => {
  try {
    console.log("REQ USER:", req.user);
    console.log("BODY:", req.body);

    const  store_id  = req.user.register_id;
    const user_id = req.user.user_id;

    const { name, phone } = req.body;

    const tenantPool = await AddressModel.getTenantDB(store_id);

    const result = await tenantPool.query(
      `UPDATE tbl_address
       SET name=$1, phone=$2
       WHERE user_id=$3 AND is_default=true`,
      [name, phone, user_id]
    );

    console.log("UPDATE RESULT:", result);

    res.json({ message: "Profile updated successfully" });

  } catch (err) {
    console.log("PROFILE UPDATE ERROR:", err);
    res.status(500).json({ message: "Something went wrong" });
  }
};

