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

// Every request here costs real money (a real Claude API call) - this
// is about capping SPEND per person, not just deterring scraping, so
// it's keyed by the signed-in user's own id rather than IP (a shared
// office/NAT IP shouldn't punish everyone on it for one person's bug
// or bot, and a per-user cap is what actually bounds worst-case cost
// per account). Falls back to IP only for a genuinely signed-out
// caller. 15/minute is comfortably above any real person typing and
// re-typing searches, and low enough that even a runaway frontend
// bug/bot can't meaningfully run up a bill before this kicks in.
export const smartSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 15,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.isAuthenticated?.() ? (req.user as any).id : req.ip),
  handler: (req, res) => {
    console.log(
      JSON.stringify({
        event: "smart_search_rate_limited",
        userId: req.isAuthenticated?.() ? (req.user as any).id : null,
      })
    );
    res.status(429).json({ message: "You're searching a bit fast - please wait a moment and try again." });
  },
});
