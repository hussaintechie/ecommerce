import express from "express";
import { auth} from "../middleware/authMiddleware.js"
import {
  addAddress,
  editAddress,
  deleteAddress,
  listAddresses,
  getAddressDetails,
  autoFillCurrentLocation,
    setDefaultAddress
} from "../controllers/addressController_user.js";

const router = express.Router();

// Apply security to all routes
router.use(auth);

router.post("/add", addAddress);
router.put("/edit/:address_id", editAddress);
router.delete("/delete/:address_id", deleteAddress);
router.get("/list", listAddresses);
router.get("/details/:address_id", getAddressDetails);
router.get("/autofill-location", autoFillCurrentLocation);
router.post("/set-default/:address_id", setDefaultAddress);



export default router;


//add

// {
//   "user_id": 12,
//   "store_id": 3,
//   "address_type": "Home",
//   "name": "Raj",
//   "phone": "9876543210",
//   "pincode": "600001",
//   "state": "Tamil Nadu",
//   "district": "Chennai",
//   "city": "Chennai",
//   "street": "Mount Road",
//   "landmark": "Near Metro",
//   "lat": "13.0827",
//   "lng": "80.2707",
//   "is_default": true
// }
///////////////////////
// https://api.sribalajistores.com/address/edit/5

// {
//   "user_id": 12,
//   "store_id": 3,
//   "address_type": "Office",
//   "city": "Chennai",
//   "street": "Anna Salai"
// }
///////////////////////
// https://api.sribalajistores.com/user/list?user_id=4&store_id=2

///
///
///https://api.sribalajistores.com/user/details/1?user_id=4&store_id=2