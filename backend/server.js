import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes.js";
import  productRouter from "./routes/productRouter.js";
import categoryModel from "./routes/categoryRouter.js";
import customerRoutes from "./routes/customerRoutes.js";

import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/auth", authRoutes);

app.use("/cat",categoryModel)
app.use("/pro",productRouter)
app.use("/customer",customerRoutes)


const PORT = 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});


export default app;
