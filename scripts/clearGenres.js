import { connect, connection } from 'mongoose';
import { Genre } from '../models/genre.model';

import { config } from 'dotenv';

// Loads .env
config();


const clearGenres = async () => {
  try {
    await connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await Genre.deleteMany({});
    console.log(`Cleared ${result.deletedCount} genres from the database`);

    await connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing genres:', error);
    process.exit(1);
  }
};

// Check if this module is being run directly
if (import.meta.url === new URL(import.meta.resolve('./scripts/clearGenres.js'))) {
  clearGenres();
}


export { clearGenres };
