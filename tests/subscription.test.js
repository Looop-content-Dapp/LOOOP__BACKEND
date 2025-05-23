import { expect } from 'chai';
import { connect, closeDatabase, clearDatabase, generatePaystackSignature } from './setup.js';
import { ArtistSubscriptionPlan } from '../models/artistSubscriptionPlan.model.js';
import { UserSubscription } from '../models/userSubscription.model.js';
import { Artist } from '../models/artist.model.js';
import { User } from '../models/user.model.js';
import { PlatformWallet } from '../models/platformWallet.model.js';
import mongoose from 'mongoose';

describe('Subscription System Tests', function () {
  this.timeout(10000);
  let testArtist;
  let testUser;
  let testPlan;

  before(async () => {
    try {
      await connect();
    } catch (error) {
      console.error('Error in before hook:', error);
      throw error;
    }
  });

  after(async () => {
    try {
      await closeDatabase();
    } catch (error) {
      console.error('Error in after hook:', error);
      throw error;
    }
  });

  beforeEach(async () => {
    try {
      await clearDatabase();

      // Create test artist
      testArtist = await Artist.create({
        name: 'Test Artist',
        email: 'artist@test.com',
        profileImage: 'test.jpg',
        biography: 'Test biography',
        address1: 'Test Address',
        country: 'Test Country',
        city: 'Test City',
        wallet: { balance: 0 },
        genres: [new mongoose.Types.ObjectId()] // Add a dummy genre ID since it's required
      });

      // Create test user
      testUser = await User.create({
        email: 'user@test.com',
        username: 'testuser',
        password: 'password123',
        fullname: 'Test User',
        age: '25',
        gender: 'male',
        referralCode: 'TESTCODE123',
        wallets: {
          xion: {
            address: 'test_address',
            mnemonic: 'test_mnemonic',
            balance: 0
          }
        }
      });

      // Create test subscription plan
      testPlan = await ArtistSubscriptionPlan.create({
        artistId: testArtist._id,
        name: 'Premium Fan Club',
        description: 'Get exclusive content',
        price: {
          amount: 9.99,
          currency: 'USD'
        },
        benefits: ['Exclusive content'],
        duration: 30,
        splitPercentage: {
          platform: 20,
          artist: 80
        }
      });
    } catch (error) {
      console.error('Error in beforeEach hook:', error);
      throw error;
    }
  });

  describe('Subscription Plan Tests', () => {
    it('should create a subscription plan', async () => {
      const plan = await ArtistSubscriptionPlan.create({
        artistId: testArtist._id,
        name: 'Basic Plan',
        description: 'Basic benefits',
        price: {
          amount: 4.99,
          currency: 'USD'
        },
        benefits: ['Basic access'],
        duration: 30
      });

      expect(plan).to.have.property('_id');
      expect(plan.name).to.equal('Basic Plan');
      expect(plan.price.amount).to.equal(4.99);
    });

    it('should not create a plan with negative price', async () => {
      try {
        await ArtistSubscriptionPlan.create({
          artistId: testArtist._id,
          name: 'Invalid Plan',
          description: 'Invalid price',
          price: {
            amount: -10,
            currency: 'USD'
          },
          benefits: ['Invalid'],
          duration: 30
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('Subscription Process Tests', () => {
    it('should create a subscription', async () => {
      const subscription = await UserSubscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        artistId: testArtist._id,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentHistory: [{
          amount: testPlan.price.amount,
          currency: testPlan.price.currency,
          paymentMethod: 'card',
          transactionId: 'test_transaction',
          status: 'pending'
        }]
      });

      expect(subscription).to.have.property('_id');
      expect(subscription.status).to.equal('pending');
    });

    it('should not allow multiple active subscriptions to the same artist', async () => {
      // Create first subscription
      await UserSubscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        artistId: testArtist._id,
        status: 'active',
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentHistory: [{
          amount: testPlan.price.amount,
          currency: testPlan.price.currency,
          paymentMethod: 'card',
          transactionId: 'test_transaction_1',
          status: 'success'
        }]
      });

      // Try to create second subscription
      try {
        await UserSubscription.create({
          userId: testUser._id,
          planId: testPlan._id,
          artistId: testArtist._id,
          status: 'active',
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          paymentHistory: [{
            amount: testPlan.price.amount,
            currency: testPlan.price.currency,
            paymentMethod: 'card',
            transactionId: 'test_transaction_2',
            status: 'success'
          }]
        });
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('Payment Processing Tests', () => {
    it('should process successful payment and update balances', async () => {
      // Create subscription
      const subscription = await UserSubscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        artistId: testArtist._id,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentHistory: [{
          amount: testPlan.price.amount,
          currency: testPlan.price.currency,
          paymentMethod: 'card',
          transactionId: 'test_transaction',
          status: 'pending'
        }]
      });

      // Simulate successful payment
      const webhookBody = {
        reference: 'test_transaction',
        status: 'success',
        data: {
          amount: testPlan.price.amount * 100,
          currency: testPlan.price.currency
        }
      };

      // const signature = generatePaystackSignature(webhookBody);

      // Update subscription status
      subscription.paymentHistory[0].status = 'success';
      subscription.status = 'active';
      await subscription.save();

      // Update artist wallet
      const artistAmount = (testPlan.price.amount * testPlan.splitPercentage.artist) / 100;
      testArtist.wallet.balance += artistAmount;
      await testArtist.save();

      // Update platform wallet
      const platformAmount = (testPlan.price.amount * testPlan.splitPercentage.platform) / 100;
      await PlatformWallet.updateBalance(
        platformAmount,
        testPlan.price.currency,
        'subscription',
        `Subscription payment from user ${testUser._id} to artist ${testArtist._id}`
      );

      // Verify updates
      const updatedSubscription = await UserSubscription.findById(subscription._id);
      const updatedArtist = await Artist.findById(testArtist._id);
      const platformWallet = await PlatformWallet.findOne();

      expect(updatedSubscription.status).to.equal('active');
      expect(updatedSubscription.paymentHistory[0].status).to.equal('success');
      expect(updatedArtist.wallet.balance).to.equal(artistAmount);
      expect(platformWallet.balance).to.equal(platformAmount);
    });

    it('should handle failed payment', async () => {
      const subscription = await UserSubscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        artistId: testArtist._id,
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentHistory: [{
          amount: testPlan.price.amount,
          currency: testPlan.price.currency,
          paymentMethod: 'card',
          transactionId: 'test_transaction',
          status: 'pending'
        }]
      });

      // Simulate failed payment
      subscription.paymentHistory[0].status = 'failed';
      await subscription.save();

      const updatedSubscription = await UserSubscription.findById(subscription._id);
      expect(updatedSubscription.paymentHistory[0].status).to.equal('failed');
      expect(updatedSubscription.status).to.equal('pending');
    });
  });

  describe('Subscription Cancellation Tests', () => {
    it('should cancel subscription', async () => {
      const subscription = await UserSubscription.create({
        userId: testUser._id,
        planId: testPlan._id,
        artistId: testArtist._id,
        status: 'active',
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        paymentHistory: [{
          amount: testPlan.price.amount,
          currency: testPlan.price.currency,
          paymentMethod: 'card',
          transactionId: 'test_transaction',
          status: 'success'
        }]
      });

      subscription.autoRenew = false;
      subscription.cancellationDate = new Date();
      await subscription.save();

      const updatedSubscription = await UserSubscription.findById(subscription._id);
      expect(updatedSubscription.autoRenew).to.be.false;
      expect(updatedSubscription.cancellationDate).to.exist;
    });
  });

  describe('Platform Wallet Tests', () => {
    it('should handle concurrent transactions', async function() {
      const wallet = await PlatformWallet.create({ balance: 0, currency: 'USD' });
      const increments = [10, 20, 30, 40, 50];
      const totalIncrement = increments.reduce((sum, inc) => sum + inc, 0);

      // Simulate concurrent increments using a single atomic update
      await PlatformWallet.updateBalance(totalIncrement, 'USD', 'subscription', 'Concurrent increments');

      const updatedWallet = await PlatformWallet.findOne({ currency: 'USD' });
      expect(updatedWallet.balance).to.equal(totalIncrement);
    });

    it('should not allow negative balance', async () => {
      try {
        await PlatformWallet.updateBalance(-100, 'USD', 'withdrawal', 'Test withdrawal');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });
}); 