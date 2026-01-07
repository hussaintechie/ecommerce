import express from "express";
import { auth } from "../middleware/authMiddleware.js";
import { getReviewStatus,submitCustomerReview} from "../controllers/review.js";

const router = express.Router();

router.use(auth);
router.get("/status", getReviewStatus);
router.post("/submit", submitCustomerReview);
export default router;