const mongoose = require('mongoose');
const Genre = require('../models/genre.model');
require('dotenv').config();

const clearGenres = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const result = await Genre.deleteMany({});
    console.log(`Cleared ${result.deletedCount} genres from the database`);

    await mongoose.connection.close();
    console.log('Database connection closed');
    process.exit(0);
  } catch (error) {
    console.error('Error clearing genres:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  clearGenres();
}

module.exports = { clearGenres };
