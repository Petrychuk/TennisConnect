import type { User } from "@shared/schema";

declare global {
  namespace Express {
    interface User extends User {}
  }
}
