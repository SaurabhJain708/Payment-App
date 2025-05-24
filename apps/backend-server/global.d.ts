// global.d.ts or types/express/index.d.ts

import { Request } from "express";

declare global {
  namespace Express {
    interface Request {
      sessionData?: {
        userId: string;
        email: string;
        detailComplete?: boolean;
        isVerified?: boolean;
      };
    }
  }
}
