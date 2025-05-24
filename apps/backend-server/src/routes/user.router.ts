import { Router } from "express";
import {
  CreatePasswordController,
  LogoutController,
  SendOtpController,
  SignInController,
  SignUpController,
  VerifyOtpController,
} from "../controllers/user.controllers.js";

const userRouter = Router();

userRouter.route("/signup").post(SignUpController);
userRouter.route("/otp").post(SendOtpController);
userRouter.route("/verify-otp").post(VerifyOtpController);
userRouter.route("/sign-in").post(SignInController);
userRouter.route("/create-password").post(CreatePasswordController);
userRouter.route("/logout").get(LogoutController);

export default userRouter;
