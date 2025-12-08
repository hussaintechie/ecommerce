import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import  productRouter from "./routes/productRouter.js";
import path from "path";
import customerRoutes from "./routes/customerRoutes.js";
import addressModel_user from "./routes/addressRouter_user.js"
import favoriteRoutes_user from "./routes/favoriteRoutes_user.js"

import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);
app.use("/fuser",favoriteRoutes_user)

app.use("/product",productRouter)
app.use("/customer",customerRoutes)
app.use("/auser",addressModel_user)
app.use('/uploads', express.static('uploads'));

const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


export default app;
