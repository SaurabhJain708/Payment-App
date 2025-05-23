import { createClient } from "redis";
import { prisma } from "@repo/db";
const client = createClient();

async function startWorker() {
  try {
    await client.connect();
    console.log("Worker connected to Redis.");

    // Main loop
    while (true) {
      const otpKeys = await client.keys("otp:*");
      if (otpKeys.length > 0) {
        for (const key of otpKeys) {
          const otpData = await client.get(key);
          if (otpData) {
            const { expiresAt, id } = JSON.parse(otpData);
            if (Date.now() > expiresAt) {
              await client.del(key);
              await prisma.otp.delete({
                where: {
                  id,
                },
              });
              console.log(`Deleted expired OTP key: ${key}`);
            }
          }
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  } catch (error) {
    console.error("Failed to connect to Redis", error);
  }
}

startWorker();
