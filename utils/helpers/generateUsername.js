// utils/helpers/generateUsername.js
const User = require('../../models/user.model');

/**
 * Generates a unique username from email address
 * Returns usernames between 6-8 characters
 */
const generateUsername = async (email) => {
  try {
    // Enhanced email validation
    if (!email || typeof email !== 'string') {
      throw new Error('Invalid or missing email');
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new Error('Invalid email format');
    }

    // Extract username part from email
    let baseUsername = email.trim().split('@')[0];

    // Clean up the username part
    baseUsername = baseUsername
      .replace(/\./g, '') // Remove dots
      .replace(/[^a-zA-Z0-9]/g, '') // Remove special characters
      .toLowerCase() // Convert to lowercase
      .slice(0, 5); // Keep only first 5 chars for base (leaving room for uniqueness digits)

    // Handle empty or invalid baseUsername
    if (!baseUsername || baseUsername.length < 2) {
      baseUsername = 'user';
    }

    // Function to check if username exists
    const isUsernameTaken = async (username) => {
      const existingUser = await User.findOne({ username });
      return !!existingUser;
    };

    // Function to generate a random string
    const generateRandomString = (length = 2) => {
      const chars = '23456789abcdefghijkmnpqrstuvwxyz'; // removed similar looking characters
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    // Ensure base length is at least 4 characters
    if (baseUsername.length < 4) {
      baseUsername = baseUsername.padEnd(4, generateRandomString(4 - baseUsername.length));
    }

    // Try different username generation strategies
    let username = baseUsername;
    let attempts = 0;
    const maxAttempts = 10;

    while (await isUsernameTaken(username) && attempts < maxAttempts) {
      attempts++;

      // Add 2-3 random characters to make final length 6-8
      const suffixLength = 2 + (attempts % 2); // alternates between 2 and 3
      const randomSuffix = generateRandomString(suffixLength);

      // Keep base length at 4-5 characters
      const baseLength = Math.min(5, 8 - suffixLength);
      const trimmedBase = baseUsername.slice(0, baseLength);

      username = `${trimmedBase}${randomSuffix}`;
    }

    // Last resort: Create a 6-character random username
    if (await isUsernameTaken(username)) {
      const shortBase = baseUsername.slice(0, 3);
      const timestamp = Date.now().toString().slice(-3);
      username = `${shortBase}${timestamp}`;
    }

    // Final validation
    if (username.length < 6 || username.length > 8) {
      throw new Error('Generated username does not meet length requirements (6-8 characters)');
    }

    return username;
  } catch (error) {
    console.error('Username generation error:', error);
    throw new Error(`Failed to generate username: ${error.message}`);
  }
};

module.exports = generateUsername;
