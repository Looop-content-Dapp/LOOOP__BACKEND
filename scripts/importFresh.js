// scripts/importFresh.js
import { clearAllData } from './clearDatabase';
import { importSpotifyData } from './importSpotifyData';

const importFresh = async () => {
  try {
    console.log('Starting fresh import process...');

    // Clear the database first
    await clearAllData();
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

// Check if this module is being run directly
if (import.meta.url === new URL(import.meta.resolve('./scripts/importFresh.js'))) {
  importFresh();
}
