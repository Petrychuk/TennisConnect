import type { User } from "@shared/schema";

declare global {
  namespace Express {
    interface User {
      id: string;
      role: "player" | "coach";
    }

    interface Request {
      user?: User;
      file?: Express.Multer.File;
    }
  }
}