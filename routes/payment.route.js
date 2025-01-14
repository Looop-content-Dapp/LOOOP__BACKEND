
import { Router } from 'express';
import { paystackWebhookHandler, verifyPaysatckTransaction } from '../controller/paystack.controller.js';

const paymentRouter = Router();

// Route to initialize a transaction (called from mobile).
paymentRouter.post('/init', paymentController);

// handles webhook transaction events sent from paystack.
paymentRouter.post('/paystack/webhook/', paystackWebhookHandler);

// verify paystack transaction status
// TODO: Endpoint currently susceptible to a form of IDOR attack, fix!!!.
paymentRouter.post('/paystack/transaction/verify', verifyPaysatckTransaction);

export default paymentRouter;
