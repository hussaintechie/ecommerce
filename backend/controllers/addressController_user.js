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
      Building,
      district,
      city,
      street,
      landmark,
      lat,
      lng,
      is_default,
      full_address,
    } = req.body;

    // ✅ VALIDATION START ----------------

    // Name mandatory
    if (!name || name.trim() === "") {
      return res.status(400).json({
        status: 0,
        message: "Name is required",
      });
    }

    // Phone mandatory
    if (!phone) {
      return res.status(400).json({
        status: 0,
        message: "Phone number is required",
      });
    }

    // Phone must be numeric & 10 digits
    const phoneRegex = /^[0-9]{10}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        status: 0,
        message: "Phone number must be exactly 10 digits",
      });
    }

    // ✅ VALIDATION END ------------------

    const tenantPool = await AddressModel.getTenantDB(store_id);

    const address_id = await AddressModel.addAddress(tenantPool, {
      user_id,
      store_id,
      address_type,
      name: name.trim(),
      phone,
      pincode,
      state,
      Building,
      district,
      city,
      street,
      landmark,
      lat,
      lng,
      is_default,
      full_address,
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
    const user_id = req.user.user_id;
    const { address_id } = req.params;
    const { name, phone } = req.body;

    // ✅ VALIDATION
    if (name !== undefined && name.trim() === "") {
      return res.status(400).json({
        status: 0,
        message: "Name cannot be empty",
      });
    }

    if (phone !== undefined) {
      const phoneRegex = /^[0-9]{10}$/;
      if (!phoneRegex.test(phone)) {
        return res.status(400).json({
          status: 0,
          message: "Phone number must be exactly 10 digits",
        });
      }
    }

    const tenantPool = await AddressModel.getTenantDB(store_id);

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
    const store_id = req.user?.register_id || req.body.register_id;
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

    if (!lat || !lng) {
      return res.status(400).json({ status: 0, message: "lat & lng required" });
    }

    const key = process.env.GOOGLE_API_KEY;

    // 1️⃣ Reverse Geocode → street/area/city/pincode
    const geoURL = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${key}`;
    const geo = await fetch(geoURL).then((r) => r.json());

    if (!geo.results || geo.results.length === 0) {
      return res.status(400).json({ status: 0, message: "Invalid location" });
    }

    const addr = geo.results[0];
    const comps = addr.address_components;

    const find = (type) =>
      comps.find((c) => c.types.includes(type))?.long_name || "";

    const street = find("route"); // Market Road
    const area =
      find("sublocality_level_1") ||
      find("sublocality") ||
      find("locality") ||
      street;

    const city =
      find("locality") ||
      find("administrative_area_level_2") ||
      "";

    const pincode = find("postal_code") || "";

    // 2️⃣ Places Nearby → building / apartment
    const placesURL = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=50&key=${key}`;
    const places = await fetch(placesURL).then((r) => r.json());

    const building = places.results?.[0]?.name || "";

    return res.json({
      status: 1,
      address: addr.formatted_address, // full human-readable
      parsed: {
        building,   // for line1
        area,       // for line2 (Area / Street)
        street,     // optional if you want
        city,
        pincode,
      },
    });
  } catch (err) {
    console.log("GOOGLE API ERROR:", err);
    return res.status(500).json({ status: 0, message: "Internal Error" });
  }
};

export const setDefaultAddress = async (req, res) => {
  try {
    const store_id = req.user.register_id;
    const user_id = req.user.user_id;
    const { address_id } = req.params;

    const tenantPool = await AddressModel.getTenantDB(store_id);

    // Validate ownership
    const address = await AddressModel.getAddressDetails(tenantPool, address_id);
    if (!address || address.user_id !== user_id) {
      return res.status(403).json({ status: 0, message: "Unauthorized" });
    }

    // 1️⃣ Set all addresses to false
    await tenantPool.query(
      `UPDATE tbl_address SET is_default = false WHERE user_id = $1`,
      [user_id]
    );

    // 2️⃣ Set selected one to true
    await tenantPool.query(
      `UPDATE tbl_address SET is_default = true WHERE address_id = $1`,
      [address_id]
    );

    return res.json({ status: 1, message: "Default address updated" });
  } catch (err) {
    console.log(err);
    return res.status(500).json({ status: 0, message: "Internal error" });
  }
};
