// scripts/importFresh.js
const clearDatabase = require('./clearDatabase');
const { importSpotifyData } = require('./importSpotifyData');

const importFresh = async () => {
  try {
    console.log('Starting fresh import process...');

    // Clear the database first
    await clearDatabase();
    console.log('Database cleared successfully');

    // Then import new data
    console.log('Starting Spotify data import...');
    await importSpotifyData();

    console.log('Import process completed successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error during import process:', error);
    process.exit(1);
  }
};

if (require.main === module) {
  importFresh();
}
