import express  from "express"
import multer from "multer"
import {addCategoryProduct ,neweditcategory ,createitmfile ,orderdatas ,submitorder ,allcatedetails ,catitems ,getuserorders,singleorddetail,
markOutForDelivery,verifyDeliveryOTP,trackOrder } from "../controllers/productController.js";
import {auth} from "../middleware/authMiddleware.js"

const router =express.Router()
router.use(auth);
router.post("/neweditcategory",neweditcategory);

router.post("/addCategoryProduct",addCategoryProduct);
router.post("/neweditcategory",neweditcategory);
router.post("/allcatedetails",allcatedetails);
router.post("/catitems",catitems);
router.post("/trackOrder",trackOrder );
router.post("/markOutForDelivery",markOutForDelivery);
router.post("/verifyDeliveryOTP",verifyDeliveryOTP)

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/createitmfile", upload.single("file"), createitmfile);
router.post("/orderdatas", orderdatas);
router.post("/submitorder", submitorder);
router.post("/getuserorders", getuserorders);
router.post("/singleorddetail", singleorddetail);

export default router;