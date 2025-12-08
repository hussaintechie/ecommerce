import { AddressModel } from "../models/addressModel_user.js";

export const addAddress = async (req, res) => {
  try {
    const store_id = req.user.register_id;
    const user_id = req.user.user_id;

    const {
      address_type,
      name,
      phone,
      pincode,
      state,
      district,
      city,
      street,
      landmark,
      lat,
      lng,
      is_default,
    } = req.body;

    const tenantPool = await AddressModel.getTenantDB(store_id);

    const address_id = await AddressModel.addAddress(tenantPool, {
      user_id,
      address_type,
      name,
      phone,
      pincode,
      state,
      district,
      city,
      street,
      landmark,
      lat,
      lng,
      is_default,
    });

    return res.json({
      status: 1,
      message: "Address added successfully",
      address_id,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ status: 0, message: err.message });
  }
};


export const editAddress = async (req, res) => {
  try {
    const store_id = req.user.register_id;
    const user_id = req.user.user_id; // used to verify ownership
    const { address_id } = req.params;

    const tenantPool = await AddressModel.getTenantDB(store_id);

    // Ensure user owns the address
    const address = await AddressModel.getAddressDetails(tenantPool, address_id);
    if (!address || address.user_id !== user_id) {
      return res.status(403).json({ status: 0, message: "Unauthorized update" });
    }

    await AddressModel.editAddress(tenantPool, address_id, req.body);

    return res.json({ status: 1, message: "Address updated successfully" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ status: 0, message: err.message });
  }
};


export const deleteAddress = async (req, res) => {
  try {
    const store_id = req.user.register_id;
    const user_id = req.user.user_id;
    const { address_id } = req.params;

    const tenantPool = await AddressModel.getTenantDB(store_id);

    // Ensure user owns it
    const address = await AddressModel.getAddressDetails(tenantPool, address_id);
    if (!address || address.user_id !== user_id) {
      return res.status(403).json({ status: 0, message: "Unauthorized delete" });
    }

    await AddressModel.deleteAddress(tenantPool, address_id);

    return res.json({ status: 1, message: "Address deleted successfully" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ status: 0, message: "Internal Error" });
  }
};


export const listAddresses = async (req, res) => {
  try {
    const store_id = req.user.register_id;
    const user_id = req.user.user_id;

    const tenantPool = await AddressModel.getTenantDB(store_id);

    const addresses = await AddressModel.listAddresses(tenantPool, user_id);

    return res.json(addresses);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ status: 0, message: "Internal Error" });
  }
};


export const getAddressDetails = async (req, res) => {
  try {
    const store_id = req.user.register_id;
    const user_id = req.user.user_id;
    const { address_id } = req.params;

    const tenantPool = await AddressModel.getTenantDB(store_id);

    const data = await AddressModel.getAddressDetails(tenantPool, address_id);

    if (!data || data.user_id !== user_id) {
      return res.status(403).json({ status: 0, message: "Unauthorized access" });
    }

    return res.json(data);
  } catch (err) {
    console.log(err);
    return res.status(500).json({ status: 0, message: "Internal Error" });
  }
};


export const autoFillCurrentLocation = async (req, res) => {
  try {
    const { lat, lng } = req.query;

    const googleURL = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.GOOGLE_API_KEY}`;

    const geo = await fetch(googleURL).then((r) => r.json());

    if (!geo.results.length) {
      return res.status(400).json({ status: 0, message: "Invalid location" });
    }

    const addr = geo.results[0];

    return res.json({
      status: 1,
      address: addr.formatted_address,
    });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ status: 0, message: "Internal Error" });
  }
};
