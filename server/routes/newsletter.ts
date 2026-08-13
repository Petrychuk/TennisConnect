import { Router } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { storage } from "../storage";

const router = Router();

// Same public-form abuse concern as the other unauthenticated write
// endpoints (support, forgot-password) - a handful of signups a minute
// from one IP is plenty for a real footer form.
const newsletterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});

const subscribeSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

// POST /api/newsletter/subscribe { email } -> { message }
//
// NOTE: this only captures the address into the newsletter_subscribers
// table - there's no outbound email-sending pipeline (ESP) wired into
// this codebase yet (no SendGrid/Mailchimp/etc. integration exists
// anywhere in the project). Actually mailing this list needs that
// piece added separately; for now it builds a real, deduplicated list
// ready to export/import into whichever ESP you pick.
router.post("/subscribe", newsletterLimiter, async (req, res, next) => {
  try {
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Please enter a valid email address" });
    }

    const { alreadySubscribed } = await storage.subscribeToNewsletter(parsed.data.email);

    return res.status(200).json({
      message: alreadySubscribed
        ? "You're already subscribed"
        : "Thanks for subscribing!",
    });
  } catch (err) {
    return next(err);
  }
});

export default router;
