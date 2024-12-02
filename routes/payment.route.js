
import { Router } from 'express';
const paymentRouter = Router();


// Route to initialize a transaction (called from mobile).
paymentRouter.post('/init', paymentController);

// handles webhook transaction events sent from paystack.
paymentRouter.post('/paystack/webhook/', paystackWebhookHandler);


export default paymentRouter;
