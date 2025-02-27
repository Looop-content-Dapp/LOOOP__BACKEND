import { Router } from "express";

import { PayAzaCardPayment } from "../utils/helpers/payaza.js";

import PaymentService from "../services/paymentService.js";
const paymentRouter = Router();

// Route to initialize a transaction (called from mobile).
// paymentRouter.post('/init', paymentController);

// handles webhook transaction events sent from paystack.
// paymentRouter.post('/paystack/webhook/', paystackWebhookHandler);

// verify paystack transaction status
// TODO: Endpoint currently susceptible to a form of IDOR attack, fix!!!.
// paymentRouter.post('/paystack/transaction/verify', verifyPaysatckTransaction);
// paymentRouter.post("/payaza/transaction/card-payment", PayAzaCardPayment);

const paymentService = new PaymentService();

paymentRouter.post("/create-plan", async (req, res) => {
  const { artistId, tribeId, name, amount, description } = req.body;
  try {
    const plan = await paymentService.createPaymentPlan(
      artistId,
      tribeId,
      name,
      amount,
      description
    );
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

paymentRouter.post("/subscribe", async (req, res) => {
  const { userId, planId, paymentMethod, currency } = req.body;

  // Add input validation
  if (!userId || !planId || !paymentMethod) {
    return res.status(400).json({
      status: "error",
      message:
        "Missing required fields. Please provide userId, planId, and paymentMethod",
    });
  }

  try {
    // Log the request details for debugging
    console.log("Subscription request:", {
      userId,
      planId,
      paymentMethod,
      currency,
    });

    const result = await paymentService.createSubscriptionPayment(
      userId,
      planId,
      paymentMethod,
      currency
    );
    res.json(result);
  } catch (error) {
    console.error("Subscription error:", {
      userId,
      planId,
      error: error.message,
      stack: error.stack,
    });

    // Return appropriate status code based on error type
    if (error.message === "Plan not found!") {
      return res.status(404).json({
        status: "error",
        message: "Plan not found",
        details: `No plan exists with ID: ${planId}`,
      });
    }

    res.status(500).json({
      status: "error",
      message: error.message,
    });
  }
});

paymentRouter.post("/one-time", async (req, res) => {
  const { userId, amount, paymentMethod } = req.body;
  const result = await paymentService.createOneTimePayment(
    userId,
    amount,
    paymentMethod
  );
  res.json(result);
});

paymentRouter.get("/callback", async (req, res) => {
  const { tx_ref } = req.query;

  try {
    console.log("Received callback for transaction:", tx_ref);

    if (!tx_ref) {
      return res.status(400).json({
        status: "error",
        message: "Transaction reference is required",
      });
    }

    const result = await paymentService.verifyPayment(tx_ref);

    // Handle different response types
    if (result.status === "error" || result.status === "failed") {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error("Callback route error:", {
      txRef: tx_ref,
      error: error.message,
      stack: error.stack,
    });

    res.status(500).json({
      status: "error",
      message: "An unexpected error occurred",
      details: error.message,
    });
  }
});

paymentRouter.post("/cancel-subscription", async (req, res) => {
  const { subscriptionId } = req.body;
  const result = await paymentService.cancelSubscription(subscriptionId);
  res.json(result);
  console.log('subscription Canceled!')
});

paymentRouter.post("/renew-subscription", async (req, res) => {
  const { subscriptionId } = req.body;
  const result = await paymentService.renewSubscription(subscriptionId);
  res.json(result);
  console.log('subscription Renewed!')
});

export default paymentRouter;
