import { Router } from 'express';
import {
  createSubscriptionPlan,
  getArtistSubscriptionPlans,
  subscribeToPlan,
  handleSubscriptionPayment,
  getUserSubscriptions,
  cancelSubscription
} from '../controller/subscription.controller.js';
import { isUser } from '../middlewares/isvaliduser.middleware.js';
import { isValidArtist } from '../middlewares/isvalidartist.middleware.js';

const subscriptionRouter = Router();

// Artist routes
subscriptionRouter.post(
  '/artist/:artistId/plans',
  isValidArtist,
  createSubscriptionPlan
);

subscriptionRouter.get(
  '/artist/:artistId/plans',
  getArtistSubscriptionPlans
);

// User subscription routes
subscriptionRouter.post(
  '/user/:userId/plan/:planId/subscribe',
  isUser,
  subscribeToPlan
);

subscriptionRouter.get(
  '/user/:userId/subscriptions',
  isUser,
  getUserSubscriptions
);

subscriptionRouter.post(
  '/subscription/:subscriptionId/cancel',
  isUser,
  cancelSubscription
);

// Payment webhook route
subscriptionRouter.post(
  '/payment/webhook',
  handleSubscriptionPayment
);

export default subscriptionRouter; 