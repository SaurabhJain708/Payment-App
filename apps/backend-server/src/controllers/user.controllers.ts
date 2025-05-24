import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { ApiError } from "../utils/Apierror";
import { ApiResponse } from "../utils/Apiresponse";
import { SendEmail } from "../utils/Resend";
import bcrypt from "bcrypt";
import { initRedis } from "../utils/redis";

export async function SignUpController(req: Request, res: Response) {
  try {
    const { email }: { email?: string } = req?.body;
    if (!email) {
      return res.status(400).json(new ApiError(400, "Please enter email"));
    }
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
      },
    });
    if (existingUser) {
      return res.status(409).json(new ApiError(409, "User already exists"));
    }
    const user = await prisma.user.create({
      data: {
        email,
      },
    });
    if (!user) {
      return res
        .status(500)
        .json(new ApiError(500, "Unable to create user, please try again"));
    }
    return res
      .status(201)
      .json(new ApiResponse(201, user, "User created successfully"));
  } catch (error) {
    console.error("Error creating user:", error);
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
}

export async function SendOtpController(req: Request, res: Response) {
  try {
    const { email }: { email: string } = req?.body;
    if (!email) {
      return res.status(400).json(new ApiError(400, "Please enter email"));
    }
    const client = await initRedis();
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
      },
    });
    if (!existingUser) {
      return res.status(404).json(new ApiError(404, "User not found"));
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
        return res
          .status(500)
          .json(new ApiError(500, "Unable to create OTP, please try again"));
      }
      // Send email with OTP
      const { otp } = transaction;
      const emailSent = await SendEmail(otp, email);
      if (!emailSent) {
        return res
          .status(500)
          .json(new ApiError(500, "Unable to send OTP, please try again"));
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
        return res
          .status(500)
          .json(new ApiError(500, "Unable to set OTP in Redis"));
      }
      return res
        .status(200)
        .json(new ApiResponse(200, null, "OTP sent successfully"));
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
      return res
        .status(500)
        .json(new ApiError(500, "Unable to create OTP, please try again"));
    }
    // Send email with OTP
    const emailSent = await SendEmail(otp, email);
    if (!emailSent) {
      return res
        .status(500)
        .json(new ApiError(500, "Unable to send OTP, please try again"));
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
      return res
        .status(500)
        .json(new ApiError(500, "Unable to set OTP in Redis"));
    }
    return res
      .status(200)
      .json(new ApiResponse(200, null, "OTP sent successfully"));
  } catch (error) {
    console.error("Error sending OTP:", error);
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
}

export async function VerifyOtpController(req: Request, res: Response) {
  try {
    const { email, otp }: { email: string; otp: string } = req?.body;
    if (!email || !otp) {
      return res
        .status(400)
        .json(new ApiError(400, "Please enter email and OTP"));
    }
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
      },
    });
    if (!existingUser) {
      return res.status(404).json(new ApiError(404, "User not found"));
    }
    const existingOtp = await prisma.otp.findFirst({
      where: {
        identifier: email,
      },
    });

    if (!existingOtp) {
      return res.status(404).json(new ApiError(404, "Invalid OTP"));
    }
    const isOtpCorrect = await bcrypt.compare(otp, existingOtp.otp);
    if (!isOtpCorrect) {
      return res.status(401).json(new ApiError(401, "Invalid OTP"));
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
      return res
        .status(500)
        .json(new ApiError(500, "Unable to verify OTP, please try again"));
    }
    req.session.user = {
      id: existingUser.id,
      email: existingUser.email,
      isVerified: existingUser.isVerified,
      detailComplete: existingUser.detailComp,
    };
    return res
      .status(200)
      .json(new ApiResponse(200, null, "OTP verified successfully"));
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
}

export async function SignInController(req: Request, res: Response) {
  try {
    const { email, password }: { email: string; password: string } = req?.body;
    if (!email || !password) {
      return res
        .status(400)
        .json(new ApiError(400, "Please enter email and password"));
    }
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
      },
    });
    if (!existingUser) {
      return res.status(404).json(new ApiError(404, "User not found"));
    }
    if (!existingUser.password) {
      return res.status(409).json(new ApiError(404, "User not verified"));
    }
    const isPasswordCorrect = await bcrypt.compare(
      password,
      existingUser.password
    );
    if (!isPasswordCorrect) {
      return res.status(401).json(new ApiError(401, "Invalid password"));
    }
    req.session.user = {
      id: existingUser.id,
      email: existingUser.email,
      isVerified: existingUser.isVerified,
      detailComplete: existingUser.detailComp,
    };
    return res
      .status(200)
      .json(new ApiResponse(200, existingUser, "User signed in successfully"));
  } catch (error) {
    console.error("Error signing in user:", error);
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
}

export async function CreatePasswordController(req: Request, res: Response) {
  try {
    if (!req.sessionData?.isVerified) {
      return res
        .status(403)
        .json(new ApiError(403, "User not verified, please verify first"));
    }
    const { password }: { email: string; password: string } = req?.body;
    const email = req.sessionData?.email;
    if (!email || !password) {
      return res
        .status(400)
        .json(new ApiError(400, "Please enter email and password"));
    }
    const existingUser = await prisma.user.findFirst({
      where: {
        email,
      },
    });
    if (!existingUser) {
      return res.status(404).json(new ApiError(404, "User not found"));
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
      return res
        .status(500)
        .json(new ApiError(500, "Unable to create password, please try again"));
    }
    req.session.user = {
      id: updatedUser.id,
      email: updatedUser.email,
      isVerified: updatedUser.isVerified,
      detailComplete: updatedUser.detailComp,
    };
    const { password: _, ...sanitizedUser } = updatedUser;
    return res
      .status(200)
      .json(
        new ApiResponse(200, sanitizedUser, "Password created successfully")
      );
  } catch (error) {
    console.error("Error creating password:", error);
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
}

export async function LogoutController(req: Request, res: Response) {
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
    return res.status(500).json(new ApiError(500, "Internal server error"));
  }
}
