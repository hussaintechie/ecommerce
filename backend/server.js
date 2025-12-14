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
import paymentRoutes from "./routes/paymentRoutes.js"
import reorderRoutes_user from "./routes/reorderRoutes_user.js";

import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  
  })
);


app.use(express.json());
app.use("/api/payment", paymentRoutes);
app.use("/ruser",reorderRoutes_user)

app.use("/auth", authRoutes);
app.use("/fuser", favoriteRoutes_user);
app.use("/puser", profileRoutes_user);
app.use("/cuser", cartRoutes_user);

app.use("/product", productRouter);
app.use("/customer", customerRoutes);
app.use("/auser", addressModel_user);
app.use("/uploads", express.static("uploads"));

const PORT = 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
