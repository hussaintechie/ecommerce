import Razorpay from "razorpay";

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
