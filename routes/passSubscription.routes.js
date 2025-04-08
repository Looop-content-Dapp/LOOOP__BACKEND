import { Router } from 'express';
import { getUserPassSubscriptions } from '../controller/passSubscription.controller.js';

const passSubscriptionRoute = Router();

passSubscriptionRoute.get('/user/:userId', getUserPassSubscriptions);

export default passSubscriptionRoute;
