import { expect } from 'chai';
import { connect, closeDatabase, clearDatabase } from './setup.js';
import { Artist } from '../models/artist.model.js';
import { Withdrawal } from '../models/withdrawal.model.js';
import mongoose from 'mongoose';

// Mock the requestWithdrawal function
const requestWithdrawal = async (req, res) => {
  const { artistId, amount, bankAccount } = req.body;
  const artist = await Artist.findById(artistId);
  if (!artist) {
    return res.status(404).json({ success: false, message: 'Artist not found' });
  }
  if (artist.wallet.balance < amount) {
    return res.status(400).json({ success: false, message: 'Insufficient balance' });
  }
  const withdrawal = new Withdrawal({ artistId, amount, bankAccount, status: 'pending' });
  await withdrawal.save();
  artist.wallet.balance -= amount;
  await artist.save();
  return res.status(200).json({ success: true, data: withdrawal });
};

describe('Withdrawal Tests', function () {
  this.timeout(10000);
  let testArtist;

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
        wallet: { balance: 100 },
        genres: [new mongoose.Types.ObjectId()]
      });
    } catch (error) {
      console.error('Error in beforeEach hook:', error);
      throw error;
    }
  });

  it('should request a withdrawal successfully', async () => {
    const req = {
      body: {
        artistId: testArtist._id,
        amount: 50,
        bankAccount: '1234567890'
      }
    };

    let responseData;
    const res = {
      status: (code) => ({
        json: (data) => {
          responseData = data;
          return res;
        }
      })
    };

    await requestWithdrawal(req, res);

    // Verify response
    expect(responseData.success).to.be.true;
    expect(responseData.data.amount).to.equal(50);
    expect(responseData.data.status).to.equal('pending');

    // Verify artist balance
    const updatedArtist = await Artist.findById(testArtist._id);
    expect(updatedArtist.wallet.balance).to.equal(50);

    // Verify withdrawal record
    const withdrawal = await Withdrawal.findOne({ artistId: testArtist._id });
    expect(withdrawal).to.exist;
    expect(withdrawal.amount).to.equal(50);
    expect(withdrawal.status).to.equal('pending');
  });

  it('should not allow withdrawal with insufficient balance', async () => {
    const req = {
      body: {
        artistId: testArtist._id,
        amount: 150,
        bankAccount: '1234567890'
      }
    };

    let responseData;
    const res = {
      status: (code) => ({
        json: (data) => {
          responseData = data;
          return res;
        }
      })
    };

    await requestWithdrawal(req, res);

    // Verify response
    expect(responseData.success).to.be.false;
    expect(responseData.message).to.equal('Insufficient balance');

    // Verify artist balance remains unchanged
    const updatedArtist = await Artist.findById(testArtist._id);
    expect(updatedArtist.wallet.balance).to.equal(100);
  });
}); 