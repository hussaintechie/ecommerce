import express  from "express"
import multer from "multer"
import {addCategoryProduct ,neweditcategory ,createitmfile ,orderdatas ,submitorder ,allcatedetails ,catitems
         ,getuserorders,singleorddetail ,getsuperdeals ,flashsaleprocess,getflashsale,submitpurchase
        ,cancelPurchaseItem,cancelPurchase,purchaselist,getPurchaseEditData,Itemslist}  from "../controllers/productController.js";
import {auth} from "../middleware/authMiddleware.js"

const router =express.Router()
router.use(auth);
router.post("/neweditcategory",neweditcategory);

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
router.post("/superdealsdata", getsuperdeals);
router.post("/flashsaleprocess", flashsaleprocess);
router.post("/getflashsale", getflashsale);
router.post("/submitpurchase", submitpurchase);
router.post("/cancelPurchaseItem", cancelPurchaseItem);
router.post("/cancelPurchase", cancelPurchase);
router.post("/purchaselist", purchaselist);
router.post("/getPurchaseEditData", getPurchaseEditData);
router.post("/Itemslist", Itemslist);

export default router;