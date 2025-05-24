import { Router } from "express";
import { SignUpController } from "../controllers/user.controllers.js";

const userRouter = Router()

userRouter.route("/signup").post(SignUpController)


export default userRouter