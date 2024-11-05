// utils/helpers/generateUsername.js
const User = require('../../models/user.model');

/**
 * Generates a unique username from Gmail address
 * Handles common Gmail username patterns and ensures uniqueness
 * Includes validation and regeneration if duplicates are found
 */
const generateUsername = async (email) => {
  try {
    if (!email || !email.includes('@')) {
      throw new Error('Invalid email format');
    }

    // Extract the part before @gmail.com
    const emailName = email.toLowerCase().split('@')[0];

    // Remove dots and special characters, Gmail ignores dots
    let baseUsername = emailName
      .replace(/[.]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '');

    // Function to check if username exists
    const isUsernameTaken = async (username) => {
      const existingUser = await User.findOne({ username });
      return !!existingUser;
    };

    // Function to generate a random string
    const generateRandomString = (length = 3) => {
      const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
      }
      return result;
    };

    // First attempt: Try base username
    let username = baseUsername;
    let attempts = 0;
    let maxAttempts = 10; // Prevent infinite loops

    while (await isUsernameTaken(username) && attempts < maxAttempts) {
      attempts++;

      // Different strategies based on attempt number
      if (attempts <= 3) {
        // First strategy: Add random 3-digit number
        const randomNum = Math.floor(Math.random() * 999).toString().padStart(3, '0');
        username = `${baseUsername}${randomNum}`;
      } else if (attempts <= 6) {
        // Second strategy: Add random alphanumeric string
        const randomString = generateRandomString(4);
        username = `${baseUsername}${randomString}`;
      } else {
        // Final strategy: Timestamp + random string for guaranteed uniqueness
        const timestamp = Date.now().toString().slice(-4);
        const randomString = generateRandomString(2);
        username = `${baseUsername}${timestamp}${randomString}`;
      }

      // Ensure username length is appropriate
      if (username.length > 20) {
        username = username.slice(0, 16) + generateRandomString(4);
      }
    }

    // If we still couldn't generate a unique username after max attempts
    if (await isUsernameTaken(username)) {
      throw new Error('Unable to generate unique username after multiple attempts');
    }

    // Ensure minimum length
    if (username.length < 3) {
      username = username.padEnd(3, '0');
    }

    return username;
  } catch (error) {
    console.error('Username generation error:', error);
    throw new Error(`Failed to generate username: ${error.message}`);
  }
};

module.exports = generateUsername;
