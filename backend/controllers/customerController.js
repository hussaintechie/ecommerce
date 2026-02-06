export const addCustomer = async (req, res) => {
  try {
    const store_id = req.user.register_id; // from JWT
    const { name, phone, email } = req.body;

    const user_id = await CustomerModel.addCustomer({
      name,
      phone,
      email,
      store_id
    });

    return res.json({
      status: 1,
      message: "Walk-in customer added successfully",
      user_id
    });

  } catch (err) {
    console.log(err);
    return res.status(500).json({ status: 0, message: "Internal Error" });
  }
};
export const listCustomers = async (req, res) => {
  try {
    const store_id = req.user.register_id; // from JWT

    const tenantPool = await CustomerModel.getTenantDB(store_id);

    const loginCustomers = await CustomerModel.listCustomersFromLogin(store_id);

    const finalList = [];

    for (const c of loginCustomers.rows) {
      let name = c.name;
      let city = null;

      if (c.added_by === "app") {
        const appInfo = await CustomerModel.getAppCustomerDetailsFromAddress(
          tenantPool,
          c.user_id
        );
        if (appInfo) {
          name = appInfo.name || name;
          city = appInfo.city;
        }
      }

      const orderSummary = await CustomerModel.getCustomerOrderSummary(
        tenantPool,
        c.user_id
      );

      finalList.push({
        user_id: c.user_id,
        name,
        phone: c.phone,
        email: c.email,
        added_by: c.added_by,
        city,
        total_orders: orderSummary.total_orders,
        total_spent: orderSummary.total_spent,
        last_order: orderSummary.last_order,
        created_at: c.created_at,
      });
    }

    return res.json(finalList);

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal error" });
  }
};
export const customerDetails = async (req, res) => {
  try {
    const store_id = req.user.register_id; // from JWT
    const { user_id } = req.params;

    const tenantPool = await CustomerModel.getTenantDB(store_id);

    const orders = await CustomerModel.getCustomerOrderSummary(
      tenantPool,
      user_id
    );

    const address = await CustomerModel.getAppCustomerDetailsFromAddress(
      tenantPool,
      user_id
    );

    return res.json({
      user_id,
      orders,
      address
    });

  } catch (err) {
    console.log(err);
    return res.status(500).json({ message: "Internal Error" });
  }
};
