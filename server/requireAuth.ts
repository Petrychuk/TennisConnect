import { Request, Response, NextFunction } from "express";

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  next();
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction
) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    return res.status(401).json({
      message: "Unauthorized",
    });
  }

  if (!(req.user as any)?.isAdmin) {
    return res.status(403).json({
      message: "Admin access required",
    });
  }

  next();
}

