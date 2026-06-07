import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import dotenv from "dotenv";
import clientRoutes from "./modules/clients/clients.routes.js";

dotenv.config();
const app = express();

connectDB();

app.use(cors());
app.use(express.json());

app.use((err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";
  res.status(statusCode).json({ message });
});

app.use("/api/clients", clientRoutes);

// initRoutes(app);

export default app;
