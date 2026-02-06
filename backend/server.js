import express from "express";
import cors from "cors";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";

// Routes
import authRoutes from "./routes/authRoutes.js";
import productRouter from "./routes/productRouter.js";
import customerRoutes from "./routes/customerRoutes.js";
import addressModel_user from "./routes/addressRouter_user.js";
import favoriteRoutes_user from "./routes/favoriteRoutes_user.js";
import profileRoutes_user from "./routes/profileRoutes_user.js";
import cartRoutes_user from "./routes/cartRoutes_user.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import reorderRoutes_user from "./routes/reorderRoutes_user.js";
import trackorderRoutes_user from "./routes/trackorderRoutes_user.js";
import userRoutes from "./routes/userRoutes.js";
import invoiceRoutes from "./routes/invoiceRouter.js";
import couponRoutes from "./routes/couponRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import deliveryPartnerModel from "./routes/deliveryPartnerRoutes.js";
import reviewRoutes from "./routes/review.js";
import orderRouter from "./routes/orderRouter.js";

dotenv.config();

const app = express();
const server = http.createServer(app);
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      "https://user.sribalajistores.com",
      "https://admin.sribalajistores.com",
      "https://api.sribalajistores.com",
      "http://localhost:8081",
      "http://localhost:5173"
    ];

    // ✅ Allow React Native / Mobile (no origin)
    if (!origin) return callback(null, true);

    // ✅ Allow Expo Web (*.exp.direct)
    if (origin.endsWith(".exp.direct")) {
      return callback(null, true);
    }

    // ✅ Allow known domains
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    callback(new Error("CORS not allowed"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));


const io = new Server(server, {
  cors: {
    origin: [
      "https://admin.sribalajistores.com",
      "http://localhost:5173"
    ],
    methods: ["GET", "POST"],
    credentials: true
  }
});

io.on("connection", (socket) => {
  console.log("🔌 Admin connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Admin disconnected:", socket.id);
  });
});

// Export io for routes/controllers
export { io };
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
/* =========================
   ROUTES
========================= */

app.get("/", (req, res) => {
  res.send("API is running successfully 🚀");
});

app.use("/api/payment", paymentRoutes);
app.use("/ruser", reorderRoutes_user);
app.use("/tuser", trackorderRoutes_user);
app.use("/invoice",invoiceRoutes) 
app.use("/coupon",couponRoutes)
app.use("/deliveryPartner", deliveryPartnerModel)
app.use("/review", reviewRoutes); 

app.use("/auth", authRoutes);
app.use("/fuser", favoriteRoutes_user);
app.use("/puser", profileRoutes_user);
app.use("/cuser", cartRoutes_user);
app.use("/usercustomer", userRoutes);
app.use("/order", orderRouter);
app.use("/product", productRouter);
app.use("/customer", customerRoutes);
app.use("/auser", addressModel_user);
app.use("/dashboard", dashboardRoutes);

// Static uploads
app.use("/uploads", express.static("uploads"));

/* =========================
   SERVER START
========================= */

const PORT = process.env.PORT || 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});

export default app;
