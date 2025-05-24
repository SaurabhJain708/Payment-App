import { Request, Response } from "express";
import { prisma } from "@repo/db";
import { ApiResponse } from "../utils/Apiresponse";

export const GetWalletBalanceController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.sessionData?.userId;
    const wallet = await prisma.user.findUnique({
      where: { id: userId },
    });
    const balance =
      wallet?.amount != null
        ? parseFloat((wallet.amount / 100).toFixed(2))
        : 0.0;
    res
      .status(200)
      .json(
        new ApiResponse(200, balance, "Wallet balance fetched successfully")
      );
  } catch (error) {
    console.error("Error fetching wallet balance:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch wallet balance",
    });
  }
};
