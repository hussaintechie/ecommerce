import express from "express";
import {
  addAddress,
  editAddress,
  deleteAddress,
  listAddresses,
  getAddressDetails,
  autoFillCurrentLocation
} from "../controllers/addressController_user.js";

const router = express.Router();

router.post("/add", addAddress);
router.put("/edit/:address_id", editAddress);
router.delete("/delete/:address_id", deleteAddress);
router.get("/list", listAddresses);
router.get("/details/:address_id", getAddressDetails);
router.get("/autofill", autoFillCurrentLocation);

export default router;
