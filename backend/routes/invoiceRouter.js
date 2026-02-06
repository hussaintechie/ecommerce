import express from "express";
import { printInvoice } from "../controllers/invoiceController.js";
import {auth} from "../middleware/authMiddleware.js"

const router = express.Router();
router.use(auth);
router.get("/orders/:orderId/invoice", printInvoice);

export default router;
