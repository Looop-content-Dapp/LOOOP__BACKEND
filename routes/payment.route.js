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
  const { userId, planId, paymentMethod } = req.body;
  try {
    const result = await paymentService.createSubscriptionPayment(
      userId,
      planId,
      paymentMethod
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
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
  const result = await paymentService.verifyPayment(tx_ref);
  res.json(result);
});

paymentRouter.post("/cancel-subscription", async (req, res) => {
  const { subscriptionId } = req.body;
  const result = await paymentService.cancelSubscription(subscriptionId);
  res.json(result);
});

paymentRouter.post("/renew-subscription", async (req, res) => {
  const { subscriptionId } = req.body;
  const result = await paymentService.renewSubscription(subscriptionId);
  res.json(result);
});

export default paymentRouter;
