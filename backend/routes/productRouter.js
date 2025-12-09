import express  from "express"
import multer from "multer"
import {addCategoryProduct ,neweditcategory ,createitmfile ,orderdatas ,submitorder ,allcatedetails ,catitems ,getuserorders,singleorddetail} from "../controllers/productController.js"

const router =express.Router()

router.post("/addCategoryProduct",addCategoryProduct);
router.post("/neweditcategory",neweditcategory);
router.post("/allcatedetails",allcatedetails);
router.post("/catitems",catitems);

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/createitmfile", upload.single("file"), createitmfile);
router.post("/orderdatas", orderdatas);
router.post("/submitorder", submitorder);
router.post("/getuserorders", getuserorders);
router.post("/singleorddetail", singleorddetail);

export default router;