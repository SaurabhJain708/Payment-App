import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { ApiError } from "../utils/Apierror";
import { ApiResponse } from "../utils/Apiresponse";
export async function SignUpController(req: Request, res: Response) {
  try {
    const { email, phoneNumber }: { email?: string; phoneNumber?: string } =
      req?.body;
    if (!email && !phoneNumber) {
      return res
        .status(400)
        .json(new ApiError(400, "Please enter email or phone number"));
    }
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { phoneNumber }],
      },
    });
    if (existingUser) {
      return res.status(409).json(new ApiError(409, "User already exists"));
    }
    const user = await prisma.user.create({
      data: {
        email,
        phoneNumber,
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
