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

    await sendTelegramNotification({
      category,
      name,
      email,
      phone,
      message,
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