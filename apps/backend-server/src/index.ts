import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import userRouter from "./routes/user.router";
import dotenv from "dotenv";
dotenv.config();
const app = express();

app.use(cors());
app.use(cookieParser());
app.use(express.json()); // Parses application/json
app.use(express.urlencoded({ extended: true }));
app.use("/auth", userRouter);

app.listen(3002);
