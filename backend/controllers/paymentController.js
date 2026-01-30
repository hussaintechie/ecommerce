import Razorpay from "razorpay";
import crypto from "crypto";


export const createRazorpayOrder = async (req, res) => {
  try {
    const { amount } = req.body;

    const razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY,
      key_secret: process.env.RAZORPAY_SECRET,
    });

    const order = await razorpay.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: "rcpt_" + Date.now(),
    });

    return res.json({
      success: true,
      orderId: order.id, // 🟢 THIS MUST BE SAVED IN FRONTEND
      amount: amount * 100,
      currency: "INR",
      key: process.env.RAZORPAY_KEY,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Order creation failed",
    });
  }
};


// export const createRazorpayOrder = async (req, res) => {
//   try {
//     const razorpay = new Razorpay({
//       key_id: process.env.RAZORPAY_KEY,
//       key_secret: process.env.RAZORPAY_SECRET,
//     });

//     // ✅ FORCE ₹1 TEST
//     const amountInPaise = 1 * 100;

//     const order = await razorpay.orders.create({
//       amount: amountInPaise,
//       currency: "INR",
//       receipt: "rcpt_" + Date.now(),
//     });

//     return res.json({
//       success: true,
//       orderId: order.id,
//       amount: order.amount, // ✅ EXACT SAME AMOUNT
//       key: process.env.RAZORPAY_KEY,
//     });
//   } catch (err) {
//     console.error("Create order error:", err);
//     return res.status(500).json({
//       success: false,
//       message: "Order creation failed",
//     });
//   }
// };



export const verifyRazorpayPayment = async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    console.log("Verify payload:", req.body);

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment fields",
      });
    }

    if (!process.env.RAZORPAY_SECRET) {
      console.error("RAZORPAY_SECRET not found");
      return res.status(500).json({
        success: false,
        message: "Server config error",
      });
    }

    const body = `${razorpay_order_id}|${razorpay_payment_id}`;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(body)
      .digest("hex");

    console.log("Expected:", expectedSignature);
    console.log("Received:", razorpay_signature);

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Signature mismatch",
      });
    }

    return res.json({ success: true });
  } catch (err) {
    console.error("Verify crash:", err);
    return res.status(500).json({
      success: false,
      message: "Verification failed",
    });
  }
};
