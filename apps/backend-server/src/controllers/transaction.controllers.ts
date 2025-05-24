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

export const SendMoneyController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const { amount, recipientId } = req.body;
    const userId = req.sessionData?.userId;
    if (!amount || !recipientId || typeof amount !== "number" || amount <= 0) {
      res.status(400).json({
        success: false,
        message: "Amount and recipient ID are required",
      });
      return;
    }
    const sender = await prisma.user.findUnique({
      where: { id: userId },
    });
    const recipient = await prisma.user.findUnique({
      where: { id: recipientId },
    });
    if (!sender || !recipient || sender.id === recipient.id) {
      res.status(404).json({
        success: false,
        message: "Sender or recipient not found",
      });
      return;
    }
    if (sender.amount < amount * 100) {
      res.status(400).json({
        success: false,
        message: "Insufficient balance",
      });
      return;
    }
    // Transaction Logic
    await prisma.$transaction(async (prisma) => {
      const deductMoneyFromSender = await prisma.user.update({
        where: { id: userId },
        data: { amount: { decrement: amount * 100 } },
      });
      if (!deductMoneyFromSender) {
        throw new Error("Failed to deduct money from sender");
      }
      const addMoneyToRecipient = await prisma.user.update({
        where: { id: recipientId },
        data: { amount: { increment: amount * 100 } },
      });
      if (!addMoneyToRecipient) {
        throw new Error("Failed to add money to recipient");
      }

      // Create transaction record
      const transactionRecord = await prisma.transaction.create({
        data: {
          senderId: userId as string,
          receiverId: recipientId,
          amount: amount * 100,
        },
      });
      if (!transactionRecord) {
        throw new Error("Failed to create transaction record");
      }
    });
    res.status(200).json({
      success: true,
      message: "Money sent successfully",
    });
  } catch (error) {
    console.error("Error sending money:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send money",
    });
  }
};

export const GetTransactionHistoryController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.sessionData?.userId;
    const page = parseInt(req.query.page as string) || 0;
    const transactions = await prisma.transaction.findMany({
      where: {
        OR: [{ senderId: userId }, { receiverId: userId }],
      },
      orderBy: { createdAt: "desc" },
      skip: page * 10,
      take: 10,
    });
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          transactions,
          "Transaction history fetched successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching transaction history:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch transaction history",
    });
  }
};

export const GetSentTransactionsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.sessionData?.userId;
    const page = parseInt(req.query.page as string) || 0;
    const transactions = await prisma.transaction.findMany({
      where: { senderId: userId },
      orderBy: { createdAt: "desc" },
      skip: page * 10,
      take: 10,
    });
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          transactions,
          "Sent transactions fetched successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching sent transactions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch sent transactions",
    });
  }
};

export const GetReceivedTransactionsController = async (
  req: Request,
  res: Response
): Promise<void> => {
  try {
    const userId = req.sessionData?.userId;
    const page = parseInt(req.query.page as string) || 0;
    const transactions = await prisma.transaction.findMany({
      where: { receiverId: userId },
      orderBy: { createdAt: "desc" },
      skip: page * 10,
      take: 10,
    });
    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          transactions,
          "Received transactions fetched successfully"
        )
      );
  } catch (error) {
    console.error("Error fetching received transactions:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch received transactions",
    });
  }
};
