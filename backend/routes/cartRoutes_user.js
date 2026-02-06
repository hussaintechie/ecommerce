import express from "express";
import {addToCart,getCart,updateCartQuantity,removeCartItem,clearCart,getCartBill,getDeliverySlots} from "../controllers/cartController_user.js"
import {auth} from "../middleware/authMiddleware.js"
const router=express.Router()
router.use(auth)
router.post("/addcart",addToCart);
router.get("/list",getCart)
router.put("/updatecart",updateCartQuantity)
router.delete("/removecart",removeCartItem)
router.delete("/clearcart",clearCart)
router.get("/bill", getCartBill);
router.get("/delivery-slots", getDeliverySlots);

export default  router;