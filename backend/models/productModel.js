export const insertProduct = async (tenantDB, data) => {
  const { 
    category_id, 
    title, 
    description, 
    price, 
    mrp, 
    quantity, 
    thumbnail 
  } = data;

  const result = await tenantDB.query(
    `INSERT INTO tbl_master_product
     (categories_id, title, description, price, mrp, quantity, thumbnail)
     VALUES ($1,$2,$3,$4,$5,$6,$7)
     RETURNING product_id`,
    [category_id, title, description, price, mrp, quantity, thumbnail]
  );

  return result.rows[0].product_id;
};

export const insertProductImage = async (tenantDB, product_id, image) => {
  await tenantDB.query(
    `INSERT INTO tbl_master_product_images (product_id, imageurl)
     VALUES ($1,$2)`,
    [product_id, image]
  );
};
