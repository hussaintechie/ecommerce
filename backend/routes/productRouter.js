import express  from "express"
import {addCategoryProduct} from "../controllers/productController.js"

const router =express.Router()

router.post("/addCategoryProduct",addCategoryProduct);

export default router;