import type { Request, Response } from "express";

/** JSON 404 for /api/* paths that no router handled (mounted after all API routes). */
export function apiNotFound(req: Request, res: Response) {
  res.status(404).json({ message: `Not found: ${req.method} ${req.baseUrl}${req.path}` });
}
