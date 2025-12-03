import express  from "express"
import multer from "multer"
import {neweditcategory ,createitmfile ,orderdatas,addProduct,getProductsByCategory} from "../controllers/productController.js"

const router =express.Router()

router.post("/neweditcategory",neweditcategory);

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/createitmfile", upload.single("file"), createitmfile);
router.post("/orderdatas", orderdatas);
router.post("/addProductsManual",addProduct)
router.post("/getByCategory", getProductsByCategory);

export default router;