import { createRequire } from "module";
const require = createRequire(import.meta.url);
import fetch from "node-fetch"; // Make sure to import fetch

import Plan from "../models/plan.model.js";
import Subscription from "../models/subscription.model.js";
import Transaction from "../models/transaction.model.js";
import {
  FLUTTERWAVE_PLAN_ID,
  FLW_SECRET_KEY,
  FLW_SECRET_HASH,
  FLUTTERWAVE_REDIRECT_URL,
  FLW_PUBLIC_KEY,
} from "../config/env.js";
import calculateUSDC from "../services/blockchainService.js";

// Validate required environment variables
if (!FLW_PUBLIC_KEY || !FLW_SECRET_KEY || !FLW_SECRET_HASH) {
  throw new Error("Missing required Flutterwave configuration keys");
}

// Initialize Flutterwave with the correct configuration
// const flw = new Flutterwave(
//   FLW_PUBLIC_KEY,
//   FLW_SECRET_KEY,
//   FLW_SECRET_HASH // Pass the encryption key directly here
// );

const FLW_BASE_URL = "https://api.flutterwave.com/v3";

class PaymentService {
  //Create a payment plan for an artist's tribe
  async createPaymentPlan(artistId, tribeId, name, amount, description) {
    const planData = {
      name: `${name} - ${tribeId}`,
      amount,
      interval: "monthly",
      currency: "USD"||"NGN",
    };

    const response = await fetch(`${FLW_BASE_URL}/payment-plans`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(planData),
    });

    const data = await response.json();

    if (data.status === "success") {
      const plan = await Plan.create({
        artistId,
        tribeId,
        name,
        amount,
        description,
        flutterwavePlanId: data.data.id,
      });

      return plan;
    }
    throw new Error("Failed to create payment plan: " + data.message);
  }

  // Subscribe a user to an artist's plan

  async createSubscriptionPayment(userId, planId, paymentMethod, currency = 'USD') {
    try {
      // Log the attempt to find the plan
      console.log('Looking for plan:', { planId });
  
      const plan = await Plan.findById(planId);
      
      // Add more detailed error handling for plan lookup
      if (!plan) {
        console.warn('Plan not found:', { planId });
        throw new Error('Plan not found!');
      }
  
      // Log the found plan details
      console.log('Found plan:', {
        planId: plan._id,
        name: plan.name,
        amount: plan.amount
      });
  
      // Validate currency
      if (!['USD', 'NGN'].includes(currency)) {
        throw new Error('Invalid currency. Only USD and NGN are supported.');
      }
  
      // Convert amount if needed
      // const finalAmount = currency === 'NGN' ? plan.amount * 1500 : plan.amount;
  
      const txRef = `sub_${Date.now()}`;
      
      // Create subscription record
      const subscription = await Subscription.create({
        userId,
        artistId: plan.artistId,
        tribeId: plan.tribeId,
        planId: plan._id,
        amount: plan.amount,
        currency,
        paymentMethod,
        status: 'pending',
        nextBillingDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      });
  
      const paymentData = {
        tx_ref: txRef,
        amount: plan.amount,
        currency,
        payment_options: paymentMethod === "applepay" ? "applepay" : "card",
        customer: { email: `${userId}@example.com` },
        redirect_url: FLUTTERWAVE_REDIRECT_URL,
        meta: { subscriptionId: subscription._id },
        payment_plan: plan.flutterwavePlanId,
      };
  
      // Log the payment request
      console.log('Initiating payment:', {
        txRef,
        amount: plan.amount,
        currency,
        paymentMethod
      });
  
      const response = await fetch(`${FLW_BASE_URL}/payments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${FLW_SECRET_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(paymentData),
      });
  
      const data = await response.json();
  
      // Log the payment response
      console.log('Payment response:', {
        txRef,
        status: data.status,
        message: data.message
      });
  
      if (data.status === 'success') {
        return {
          paymentLink: data.data.link,
          subscriptionId: subscription._id,
          txRef,
        };
      }
  
      // If payment initiation fails, update subscription status
      await Subscription.findByIdAndUpdate(subscription._id, { status: 'failed' });
      throw new Error("Payment initiation failed: " + data.message);
  
    } catch (error) {
      console.error('Subscription payment error:', {
        userId,
        planId,
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  async verifyPayment(txRef) {
    const response = await fetch(
      `${FLW_BASE_URL}/transactions/${txRef}/verify`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${FLW_SECRET_KEY}`,
        },
      }
    );

    const data = await response.json();

    if (data.status === "success") {
      const transaction = await Transaction.create({
        userId: data.data.customer.email.split("@")[0],
        amount: data.data.amount,
        currency: data.data.currency,
        transactionHash: data.data.tx_ref,
        status: "success",
        paymentMethod: data.data.payment_type,
        flutterwaveTxRef: txRef,
      });

      if (data.data.meta?.subscriptionId) {
        const subscription = await Subscription.findById(
          data.data.meta.subscriptionId
        );
        subscription.status = "active";
        subscription.flutterwaveSubscriptionId =
          data.data.payment_plan?.subscription_id || txRef;
        await subscription.save();

        const usdcEquivalent = await calculateUSDC(data.data.amount);
        transaction.usdcEquivalent = usdcEquivalent;
        await transaction.save();

        console.log("token issued here");
      }
      return { transaction };
    }
    throw new Error("Payment verification failed: " + data.message);
  }

  // Cancel Subscription
  async cancelSubscription(subscriptionId) {
    const subscription = await Subscription.findById(subscriptionId);
    if (subscription.flutterwaveSubscriptionId) {
      const response = await fetch(
        `${FLW_BASE_URL}/subscriptions/${subscription.flutterwaveSubscriptionId}/cancel`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${FLW_SECRET_KEY}`,
          },
        }
      );

      const data = await response.json();
      if (data.status !== "success") {
        throw new Error("Failed to cancel subscription: " + data.message);
      }
    }

    subscription.status = "inactive";
    subscription.gracePeriodEnd = new Date(
      Date.now() + 5 * 24 * 60 * 60 * 1000
    );
    await subscription.save();
    return subscription;
  }

  // Renew Subscription (Manual Trigger)
  async renewSubscription(subscriptionId) {
    const subscription = await Subscription.findById(subscriptionId);
    if (
      subscription.status === "inactive" &&
      new Date() <= subscription.gracePeriodEnd
    ) {
      subscription.status = "pending";
      await subscription.save();
      return this.createSubscriptionPayment(
        subscription.userId,
        subscription.planId,
        subscription.paymentMethod
      );
    }
    throw new Error("Subscription cannot be renewed");
  }

  // One-Time Payment (Unchanged)
  async createOneTimePayment(userId, amount, paymentMethod) {
    const txRef = `one_${Date.now()}`;
    const paymentData = {
      tx_ref: txRef,
      amount,
      currency: "USD" || "NGN",
      payment_options: paymentMethod === "applepay" ? "applepay" : "card",
      customer: { email: `${userId}@example.com` },
      redirect_url: FLUTTERWAVE_REDIRECT_URL,
    };

    const response = await fetch(`${FLW_BASE_URL}/payments`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${FLW_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paymentData),
    });

    const data = await response.json();

    if (data.status === "success") {
      return { paymentLink: data.data.link, txRef };
    }
    throw new Error("Payment initiation failed: " + data.message);
  }
}

export default PaymentService;
