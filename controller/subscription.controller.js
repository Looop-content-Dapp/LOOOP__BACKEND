import { ArtistSubscriptionPlan } from '../models/artistSubscriptionPlan.model.js';
import { UserSubscription } from '../models/userSubscription.model.js';
import { User } from '../models/user.model.js';
import { Artist } from '../models/artist.model.js';
import { PlatformWallet } from '../models/platformWallet.model.js';
import mongoose from 'mongoose';
import { initializePaystackTransaction } from './paystack.controller.js';
import crypto from 'crypto';

// Create a new subscription plan for an artist
export const createSubscriptionPlan = async (req, res) => {
  try {
    const { artistId } = req.params;
    const planData = req.body;

    // Verify artist exists
    const artist = await Artist.findById(artistId);
    if (!artist) {
      return res.status(404).json({
        success: false,
        message: 'Artist not found'
      });
    }

    // Create new plan
    const plan = new ArtistSubscriptionPlan({
      artistId,
      ...planData
    });

    await plan.save();

    return res.status(201).json({
      success: true,
      message: 'Subscription plan created successfully',
      data: plan
    });
  } catch (error) {
    console.error('Error creating subscription plan:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating subscription plan',
      error: error.message
    });
  }
};

// Get all subscription plans for an artist
export const getArtistSubscriptionPlans = async (req, res) => {
  try {
    const { artistId } = req.params;
    const plans = await ArtistSubscriptionPlan.find({
      artistId,
      status: 'active'
    });

    return res.status(200).json({
      success: true,
      data: plans
    });
  } catch (error) {
    console.error('Error fetching subscription plans:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching subscription plans',
      error: error.message
    });
  }
};

// Subscribe to an artist's plan
export const subscribeToPlan = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { userId, planId } = req.params;
    const { paymentMethod } = req.body;

    // Get plan details
    const plan = await ArtistSubscriptionPlan.findById(planId);
    if (!plan) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Subscription plan not found'
      });
    }

    // Check if user already has an active subscription
    const existingSubscription = await UserSubscription.findOne({
      userId,
      artistId: plan.artistId,
      status: 'active'
    });

    if (existingSubscription) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'User already has an active subscription to this artist'
      });
    }

    // Calculate end date
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + plan.duration);

    // Create subscription record
    const subscription = new UserSubscription({
      userId,
      planId,
      artistId: plan.artistId,
      endDate,
      paymentHistory: [{
        amount: plan.price.amount,
        currency: plan.price.currency,
        paymentMethod,
        transactionId: 'pending', // Will be updated after payment
        status: 'pending'
      }]
    });

    await subscription.save({ session });

    // Initialize payment
    const paymentResult = await initializePaystackTransaction(
      req,
      res,
      req.user.email,
      plan.price.amount * 100 // Convert to kobo/cents
    );

    if (!paymentResult.success) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: 'Payment initialization failed',
        error: paymentResult.message
      });
    }

    // Update subscription with payment details
    subscription.paymentHistory[0].transactionId = paymentResult.data.reference;
    await subscription.save({ session });

    // Update plan subscriber count
    plan.subscriberCount += 1;
    await plan.save({ session });

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: 'Subscription created successfully',
      data: {
        subscription,
        paymentUrl: paymentResult.data.authorization_url
      }
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error creating subscription:', error);
    return res.status(500).json({
      success: false,
      message: 'Error creating subscription',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Handle subscription payment webhook
export const handleSubscriptionPayment = async (req, res) => {
  // Verify Paystack signature
  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    return res.status(401).json({
      success: false,
      message: 'Invalid signature'
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { reference, status, data } = req.body;

    // Find subscription by payment reference
    const subscription = await UserSubscription.findOne({
      'paymentHistory.transactionId': reference
    });

    if (!subscription) {
      await session.abortTransaction();
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    // Update payment status
    const payment = subscription.paymentHistory.find(
      p => p.transactionId === reference
    );
    
    if (payment) {
      payment.status = status === 'success' ? 'success' : 'failed';
      
      if (status === 'success') {
        subscription.status = 'active';
        subscription.lastRenewalDate = new Date();
        subscription.nextRenewalDate = subscription.endDate;
      }
    }

    await subscription.save({ session });

    // If payment successful, update artist's earnings and platform wallet
    if (status === 'success') {
      const plan = await ArtistSubscriptionPlan.findById(subscription.planId);
      if (plan) {
        const artistAmount = (plan.price.amount * plan.splitPercentage.artist) / 100;
        const platformAmount = (plan.price.amount * plan.splitPercentage.platform) / 100;

        // Update artist's wallet balance
        const artist = await Artist.findById(plan.artistId);
        if (!artist.wallet) {
          artist.wallet = { balance: 0 };
        }
        artist.wallet.balance += artistAmount;
        await artist.save({ session });

        // Update platform's wallet balance
        await PlatformWallet.updateBalance(
          platformAmount,
          plan.price.currency,
          'subscription',
          `Subscription payment from user ${subscription.userId} to artist ${plan.artistId}`
        );
      }
    }

    await session.commitTransaction();

    return res.status(200).json({
      success: true,
      message: 'Payment processed successfully'
    });
  } catch (error) {
    await session.abortTransaction();
    console.error('Error processing payment:', error);
    return res.status(500).json({
      success: false,
      message: 'Error processing payment',
      error: error.message
    });
  } finally {
    session.endSession();
  }
};

// Get user's active subscriptions
export const getUserSubscriptions = async (req, res) => {
  try {
    const { userId } = req.params;

    const subscriptions = await UserSubscription.find({
      userId,
      status: 'active'
    }).populate('planId');

    return res.status(200).json({
      success: true,
      data: subscriptions
    });
  } catch (error) {
    console.error('Error fetching user subscriptions:', error);
    return res.status(500).json({
      success: false,
      message: 'Error fetching user subscriptions',
      error: error.message
    });
  }
};

// Cancel subscription
export const cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId } = req.params;

    const subscription = await UserSubscription.findById(subscriptionId);
    if (!subscription) {
      return res.status(404).json({
        success: false,
        message: 'Subscription not found'
      });
    }

    subscription.autoRenew = false;
    subscription.cancellationDate = new Date();
    await subscription.save();

    return res.status(200).json({
      success: true,
      message: 'Subscription cancelled successfully'
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    return res.status(500).json({
      success: false,
      message: 'Error cancelling subscription',
      error: error.message
    });
  }
}; 