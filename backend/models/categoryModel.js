export const insertCategory = async (tenantDB, category_name) => {
  const result = await tenantDB.query(
    `INSERT INTO tbl_master_categories (categories_name)
     VALUES ($1)
     RETURNING categories_id`,
    [category_name]
  );
  return result.rows[0].categories_id;
};
