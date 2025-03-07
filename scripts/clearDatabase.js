import mongoose from 'mongoose';
import { config } from 'dotenv';

// Loads .env
config();

const clearAllData = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Get all collections in the database
    const collections = await mongoose.connection.db.collections();

    // Delete all data from each collection
    for (const collection of collections) {
      await collection.deleteMany({});
      console.log(`Cleared collection: ${collection.collectionName}`);
    }

    console.log('All database collections cleared successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing database:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
  }
};

// Run if called directly
if (import.meta.url === new URL(import.meta.resolve('./scripts/clearDatabase.js'))) {
  clearAllData();
}

clearAllData()

export { clearAllData };
