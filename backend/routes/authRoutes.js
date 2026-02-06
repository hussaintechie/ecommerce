import express from "express";
import {
  adminRegister,
  login,
 
} from "../controllers/authController.js";

const router = express.Router();

router.post("/admin/register", adminRegister);
router.post("/login", login);

export default router;
