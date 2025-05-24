import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { ApiError } from "../utils/Apierror.js";
import { ApiResponse } from "../utils/Apiresponse.js";
import { SendEmail } from "../utils/Resend.js";
import bcrypt from "bcrypt";
import { initRedis } from "../utils/redis.js";

export const SignUpController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email }: { email?: string } = req?.body;
    if (!email) {
      res.status(400).json(new ApiError(400, "Please enter email"));
      return;
    }
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
      },
    });
    if (existingUser) {
      res.status(409).json(new ApiError(409, "User already exists"));
      return;
    }
    const user = await prisma.user.create({
      data: {
        email,
      },
    });
    if (!user) {
      res
        .status(500)
        .json(new ApiError(500, "Unable to create user, please try again"));

      return;
    }
    res
      .status(201)
      .json(new ApiResponse(201, user, "User created successfully"));
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

export const SendOtpController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email }: { email: string } = req?.body;
    if (!email) {
      res.status(400).json(new ApiError(400, "Please enter email"));
      return;
    }
    const client = await initRedis();
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
      },
    });
    if (!existingUser) {
      res.status(404).json(new ApiError(404, "User not found"));
      return;
    }
    const existingOtp = await prisma.otp.findFirst({
      where: {
        identifier: email,
      },
    });
    if (existingOtp) {
      const transaction = await prisma.$transaction(async (prismaTx) => {
        const deleteOtp = await prismaTx.otp.delete({
          where: {
            identifier: email,
          },
        });
        if (!deleteOtp) {
          throw new Error("Unable to delete existing OTP");
        }
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const hashedOtp = await bcrypt.hash(otp, 10);
        const newOtp = await prismaTx.otp.create({
          data: {
            identifier: email,
            otp: hashedOtp,
          },
        });
        if (!newOtp) {
          throw new Error("Unable to create OTP");
        }

        const removeOtp = await client.del(`otp:${existingOtp.id}`);
        if (!removeOtp) {
          throw new Error("Unable to delete existing OTP from Redis");
        }
        return { newOtp, otp };
      });
      if (!transaction.newOtp || !transaction.otp) {
        res
          .status(500)
          .json(new ApiError(500, "Unable to create OTP, please try again"));
        return;
      }
      // Send email with OTP
      const { otp } = transaction;
      const emailSent = await SendEmail(otp, email);
      if (!emailSent) {
        res
          .status(500)
          .json(new ApiError(500, "Unable to send OTP, please try again"));
        return;
      }
      const expiresAt = Date.now() + 6 * 60 * 1000;
      const otpData = {
        expiresAt,
        id: transaction.newOtp.id,
      };
      const redisKey = `otp:${transaction.newOtp.id}`;
      const redisSet = await client.set(redisKey, JSON.stringify(otpData), {
        EX: 5 * 60, // 5 minutes
        NX: true,
      });
      if (!redisSet) {
        res.status(500).json(new ApiError(500, "Unable to set OTP in Redis"));
        return;
      }
      res.status(200).json(new ApiResponse(200, null, "OTP sent successfully"));
      return;
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedOtp = await bcrypt.hash(otp, 10);
    const newOtp = await prisma.otp.create({
      data: {
        identifier: email,
        otp: hashedOtp,
      },
    });
    if (!newOtp) {
      res
        .status(500)
        .json(new ApiError(500, "Unable to create OTP, please try again"));
      return;
    }
    // Send email with OTP
    const emailSent = await SendEmail(otp, email);
    if (!emailSent) {
      res
        .status(500)
        .json(new ApiError(500, "Unable to send OTP, please try again"));
      return;
    }
    const expiresAt = Date.now() + 5 * 60 * 1000;
    const otpData = {
      expiresAt,
      id: newOtp.id,
    };
    const redisKey = `otp:${newOtp.id}`;
    const redisSet = await client.set(redisKey, JSON.stringify(otpData), {
      EX: 5 * 60,
      NX: true,
    });
    if (!redisSet) {
      res.status(500).json(new ApiError(500, "Unable to set OTP in Redis"));
      return;
    }
    res.status(200).json(new ApiResponse(200, null, "OTP sent successfully"));
  } catch (error) {
    console.error("Error sending OTP:", error);
    res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

export const VerifyOtpController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, otp }: { email: string; otp: string } = req?.body;
    if (!email || !otp) {
      res.status(400).json(new ApiError(400, "Please enter email and OTP"));
      return;
    }
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
      },
    });
    if (!existingUser) {
      res.status(404).json(new ApiError(404, "User not found"));
      return;
    }
    const existingOtp = await prisma.otp.findFirst({
      where: {
        identifier: email,
      },
    });

    if (!existingOtp) {
      res.status(404).json(new ApiError(404, "Invalid OTP"));
      return;
    }
    const isOtpCorrect = await bcrypt.compare(otp, existingOtp.otp);
    if (!isOtpCorrect) {
      res.status(401).json(new ApiError(401, "Invalid OTP"));
      return;
    }
    const transaction = await prisma.$transaction(async (prismaTx) => {
      const deleteOtp = await prismaTx.otp.delete({
        where: {
          identifier: email,
        },
      });
      if (!deleteOtp) {
        throw new Error("Unable to delete existing OTP");
      }
      const client = await initRedis();
      const deleteRedisOtp = await client.del(`otp:${existingOtp.id}`);
      if (!deleteRedisOtp) {
        throw new Error("Unable to delete existing OTP from Redis");
      }
      const updatedUser = await prismaTx.user.update({
        where: {
          email,
        },
        data: {
          isVerified: true,
          detailComp: false, // Assuming detail completion is set to false on verification
        },
      });
      if (!updatedUser) {
        throw new Error("Unable to update user verification status");
      }
      return deleteOtp;
    });
    if (!transaction) {
      res
        .status(500)
        .json(new ApiError(500, "Unable to verify OTP, please try again"));
      return;
    }
    req.session.user = {
      id: existingUser.id,
      email: existingUser.email,
      isVerified: existingUser.isVerified,
      detailComplete: existingUser.detailComp,
    };
    res
      .status(200)
      .json(new ApiResponse(200, null, "OTP verified successfully"));
  } catch (error) {
    console.error("Error verifying OTP:", error);
    res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

export const SignInController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { email, password }: { email: string; password: string } = req?.body;
    if (!email || !password) {
      res
        .status(400)
        .json(new ApiError(400, "Please enter email and password"));
      return;
    }
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
      },
    });
    if (!existingUser) {
      res.status(404).json(new ApiError(404, "User not found"));
      return;
    }
    if (!existingUser.password) {
      res.status(409).json(new ApiError(404, "User not verified"));
      return;
    }
    const isPasswordCorrect = await bcrypt.compare(
      password,
      existingUser.password
    );
    if (!isPasswordCorrect) {
      res.status(401).json(new ApiError(401, "Invalid password"));
      return;
    }
    req.session.user = {
      id: existingUser.id,
      email: existingUser.email,
      isVerified: existingUser.isVerified,
      detailComplete: existingUser.detailComp,
    };
    res
      .status(200)
      .json(new ApiResponse(200, existingUser, "User signed in successfully"));
  } catch (error) {
    console.error("Error signing in user:", error);
    res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

export const CreatePasswordController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    if (!req.sessionData?.isVerified) {
      res
        .status(403)
        .json(new ApiError(403, "User not verified, please verify first"));
      return;
    }
    const { password }: { email: string; password: string } = req?.body;
    const email = req.sessionData?.email;
    if (!email || !password) {
      res
        .status(400)
        .json(new ApiError(400, "Please enter email and password"));
      return;
    }
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
      },
    });
    if (!existingUser) {
      res.status(404).json(new ApiError(404, "User not found"));
      return;
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const updatedUser = await prisma.user.update({
      where: {
        email,
      },
      data: {
        password: hashedPassword,
        isVerified: true,
        detailComp: true,
      },
    });
    if (!updatedUser) {
      res
        .status(500)
        .json(new ApiError(500, "Unable to create password, please try again"));
      return;
    }
    req.session.user = {
      id: updatedUser.id,
      email: updatedUser.email,
      isVerified: updatedUser.isVerified,
      detailComplete: updatedUser.detailComp,
    };
    const { password: _, ...sanitizedUser } = updatedUser;
    res
      .status(200)
      .json(
        new ApiResponse(200, sanitizedUser, "Password created successfully")
      );
  } catch (error) {
    console.error("Error creating password:", error);
    res.status(500).json(new ApiError(500, "Internal server error"));
  }
};

export const LogoutController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    req.session.destroy((err) => {
      if (err) {
        console.error("Error destroying session:", err);
        return res.status(500).json({ message: "Failed to log out" });
      }

      res.clearCookie("connect.sid"); // ensure cookie is cleared from browser
      return res.status(200).json({ message: "Logged out successfully" });
    });
  } catch (error) {
    console.error("Error logging out user:", error);
    res.status(500).json(new ApiError(500, "Internal server error"));
  }
};
