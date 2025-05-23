import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import crypto from 'crypto';

let mongoServer;

// Connect to the in-memory database
export const connect = async () => {
  try {
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
  } catch (error) {
    console.error('Error connecting to MongoDB:', error);
    throw error;
  }
};

// Drop database, close the connection and stop mongodb
export const closeDatabase = async () => {
  try {
    if (mongoServer) {
      await mongoose.disconnect();
      await mongoServer.stop();
    }
  } catch (error) {
    console.error('Error closing database:', error);
    throw error;
  }
};

// Clear all data in the database
export const clearDatabase = async () => {
  try {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany();
    }
  } catch (error) {
    console.error('Error clearing database:', error);
    throw error;
  }
};

// Mock Paystack webhook signature
export const generatePaystackSignature = (body) => {
  const secret = process.env.PAYSTACK_SECRET_KEY || 'test_secret_key';
  const hash = crypto
    .createHmac('sha512', secret)
    .update(JSON.stringify(body))
    .digest('hex');
  return hash;
}; 