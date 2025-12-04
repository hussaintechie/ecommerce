import { FavoriteModel } from "../models/favoriteModel_user.js";

export const toggleFavorite = async (req, res) => {
  try {
    const { user_id, product_id, store_id } = req.body;

    if (!user_id || !product_id || !store_id) {
      return res.status(400).json({ message: "Missing fields" });
    }

    // get tenant pool
    const tenantPool = await FavoriteModel.getTenantDB(store_id);

    // check if already exists
    const exists = await FavoriteModel.checkFavorite(
      tenantPool,
      user_id,
      product_id
    );

    if (exists.length > 0) {
      await FavoriteModel.removeFavorite(tenantPool, user_id, product_id);
      return res.json({ message: "Removed from favorites", status: false });
    }

    await FavoriteModel.addFavorite(tenantPool, user_id, product_id);

    res.json({ message: "Added to favorites", status: true });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
export const getFavorites = async (req, res) => {
  try {
    const { user_id, store_id } = req.query;

    const tenantPool = await FavoriteModel.getTenantDB(store_id);

    const data = await FavoriteModel.listFavorites(tenantPool, user_id);

    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
