import { expect } from 'chai';
import { connect, closeDatabase, clearDatabase } from './setup.js';
import { Post } from '../models/post.model.js';
import { UserSubscription } from '../models/userSubscription.model.js';
import { Artist } from '../models/artist.model.js';
import { User } from '../models/user.model.js';
import mongoose from 'mongoose';
import { getPrivatePostsForSubscribers } from '../controller/post.controller.js';

describe('Post Tests', function () {
  this.timeout(10000);
  let testUser, testArtist, testPost;

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

      // Create test user
      testUser = await User.create({
        email: 'user@test.com',
        fullname: 'Test User',
        age: 25,
        gender: 'male',
        referralCode: 'TEST123',
        username: 'testuser',
        password: 'password123'
      });

      // Create test artist
      testArtist = await Artist.create({
        name: 'Test Artist',
        email: 'artist@test.com',
        profileImage: 'test.jpg',
        biography: 'Test biography',
        address1: 'Test Address',
        country: 'Test Country',
        city: 'Test City',
        wallet: { balance: 100 },
        genres: [new mongoose.Types.ObjectId()]
      });

      // Create test post
      testPost = await Post.create({
        content: 'Test post content',
        title: 'Test Post',
        postType: 'regular',
        artistId: testArtist._id,
        communityId: new mongoose.Types.ObjectId(),
        visibility: 'private',
        status: 'published',
        category: 'other'
      });

      // Create a subscription for the user
      await UserSubscription.create({
        userId: testUser._id,
        artistId: testArtist._id,
        status: 'active',
        endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        planId: new mongoose.Types.ObjectId()
      });
    } catch (error) {
      console.error('Error in beforeEach hook:', error);
      throw error;
    }
  });

  it('should fetch private posts for a subscribed user', async () => {
    const req = {
      params: { userId: testUser._id },
      query: { artistId: testArtist._id }
    };

    const res = {
      status: (code) => ({
        json: (data) => {
          expect(data.message).to.equal('Successfully retrieved private posts');
          expect(data.data).to.be.an('array');
          expect(data.data[0].content).to.equal('Test post content');
        }
      })
    };

    await getPrivatePostsForSubscribers(req, res);
  });

  it('should not fetch private posts for a non-subscribed user', async () => {
    // Remove the subscription to simulate a non-subscribed user
    await UserSubscription.deleteOne({ userId: testUser._id, artistId: testArtist._id });

    const req = {
      params: { userId: testUser._id },
      query: { artistId: testArtist._id }
    };

    const res = {
      status: (code) => ({
        json: (data) => {
          expect(data.message).to.equal('You are not subscribed to this artist');
        }
      })
    };

    await getPrivatePostsForSubscribers(req, res);
  });
}); 