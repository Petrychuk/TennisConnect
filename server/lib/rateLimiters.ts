import rateLimit from "express-rate-limit";

// Generous enough that a real person browsing/searching normally never
// notices it - this is aimed at automated bulk scraping of the
// Players/Coaches directory (paginating through every profile quickly),
// not at slowing down legitimate use. 120/minute is ~2 requests per
// second sustained, well above what a human clicking through pages or
// typing a search query could produce, but well below what a script
// doing a full-directory sweep would want to run at.
export const publicBrowseLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please slow down and try again shortly." },
});
