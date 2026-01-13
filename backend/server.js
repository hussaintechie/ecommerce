import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import productRouter from "./routes/productRouter.js";
import path from "path";
import customerRoutes from "./routes/customerRoutes.js";
import addressModel_user from "./routes/addressRouter_user.js";
import favoriteRoutes_user from "./routes/favoriteRoutes_user.js";
import profileRoutes_user from "./routes/profileRoutes_user.js";
import cartRoutes_user from "./routes/cartRoutes_user.js";
import paymentRoutes from "./routes/paymentRoutes.js";
import reorderRoutes_user from "./routes/reorderRoutes_user.js";
import trackorderRoutes_user from "./routes/trackorderRoutes_user.js";
import userRoutes from "./routes/userRoutes.js";
import invoiceRoutes from "./routes/invoiceRouter.js"
import couponRoutes from "./routes/couponRoutes.js";
import  dashboardRoutes  from "./routes/dashboardRoutes.js";
import http from "http";
import { Server } from "socket.io";
import dotenv from "dotenv";
import deliveryPartnerModel from "./routes/deliveryPartnerRoutes.js";
import reviewRoutes from "./routes/review.js";
dotenv.config();

const app = express();
const server = http.createServer(app);
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      "https://user.sribalajistores.com",
      "https://api.sribalajistores.com",
      "http://localhost:8081",
      "https://admin.sribalajistores.com",
      "http://localhost:5173"
    ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS not allowed"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

const io = new Server(server, {
  cors: {
    origin: "*", // dev only
    credentials: true,
  }
});

io.on("connection", (socket) => {
  console.log("🔌 Admin connected:", socket.id);

  socket.on("disconnect", () => {
    console.log("❌ Admin disconnected:", socket.id);
  });
});
app.get("/", (req, res) => {
  res.send("API is running successfully 🚀");
});
// 👇 EXPORT io (VERY IMPORTANT)
export { io };
app.use(express.json());
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
app.use("/usercustomer",userRoutes)

app.use("/product", productRouter);
app.use("/customer", customerRoutes);
app.use("/auser", addressModel_user);
app.use("/dashboard", dashboardRoutes);
app.use("/uploads", express.static("uploads"));

const PORT = 5000;

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
