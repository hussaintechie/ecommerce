import express from "express"
import multer from "multer"
import {
    addCategoryProduct, neweditcategory, createitmfile,   allcatedetails, catitems, 
    verifyDeliveryOTP, trackOrder, getsuperdeals, flashsaleprocess, getflashsale, submitpurchase
    , cancelPurchaseItem, cancelPurchase, purchaselist, getPurchaseEditData, Itemslist, unitlist, saveItem
    , Optionitems, Lowstockdetails, getDashboardDatas, getChartdetails,Superdealdata
} from "../controllers/productController.js";
import { auth } from "../middleware/authMiddleware.js"

const router = express.Router()
router.use(auth);
router.post("/neweditcategory", neweditcategory);

router.post("/addCategoryProduct", addCategoryProduct);
router.post("/neweditcategory", neweditcategory);
router.post("/allcatedetails", allcatedetails);
router.post("/catitems", catitems);
router.post("/trackOrder", trackOrder);
//router.post("/markOutForDelivery", markOutForDelivery);
router.post("/verifyDeliveryOTP", verifyDeliveryOTP)

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/createitmfile", upload.single("file"), createitmfile);

router.post("/superdealsdata", getsuperdeals);
router.post("/flashsaleprocess", flashsaleprocess);
router.post("/getflashsale", getflashsale);
router.post("/submitpurchase", submitpurchase);
router.post("/cancelPurchaseItem", cancelPurchaseItem);
router.post("/cancelPurchase", cancelPurchase);
router.post("/purchaselist", purchaselist);
router.post("/getPurchaseEditData", getPurchaseEditData);
router.post("/Itemslist", Itemslist);
router.post("/unitlist", unitlist);
router.post("/saveItem", saveItem);
router.post("/Optionitems", Optionitems);
router.post("/Lowstockdetails", Lowstockdetails);
router.post("/getDashboardDatas", getDashboardDatas);
router.post("/getChartdetails", getChartdetails);
router.post("/Superdealdata", Superdealdata);

export default router;