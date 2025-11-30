import express from "express";
import { addCustomer, listCustomers, customerDetails } from "../controllers/customerController.js";

const router = express.Router();

router.post("/add", addCustomer);
router.get("/list", listCustomers);
router.get("/details/:user_id", customerDetails);

export default router;
