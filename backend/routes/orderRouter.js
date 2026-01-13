import express from "express"
import {orderdatas, submitorder, getuserorders, singleorddetail,customerOrderList} from "../controllers/orderController.js";
import { auth } from "../middleware/authMiddleware.js"

const router = express.Router()
router.use(auth);

router.post("/orderdatas", orderdatas);
router.post("/submitorder", submitorder);
router.post("/getuserorders", getuserorders);
router.post("/singleorddetail", singleorddetail);
router.post("/customer-orders", customerOrderList);
export default router;