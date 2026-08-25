import { Router } from "express";
import { sendTelegramNotification } from "../services/telegramService";
import { storage } from "../storage";

const router = Router();
  
router.post("/", async (req, res) => {
  try {
    const {
      category,
      name,
      email,
      phone,
      message,
    } = req.body;

    const supportRequest =
      await storage.createSupportRequest({
        category,
        name,
        email,
        phone,
        message,
      });

    // Fired, not awaited: this is just an internal alert to staff, not
    // something the submitter's success response should depend on. It
    // used to be awaited here, which meant a slow/failing Telegram call
    // both held the HTTP response open (see telegramService.ts's now-
    // fixed missing timeout) AND, since it was inside this same try
    // block, turned into a 500 error response even though the support
    // request itself had already saved successfully to the database.
    sendTelegramNotification({
      category,
      name,
      email,
      phone,
      message,
    }).catch((error) => {
      console.error("Telegram notification failed for support request", supportRequest.id, error);
    });

    return res.status(201).json(supportRequest);

  } catch (error) {
    console.error(error);

    return res.status(500).json({
      success: false,
      message: "Failed to create support request",
    });
  }
});

export default router;