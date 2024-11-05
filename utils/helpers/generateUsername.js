// utils/helpers/generateUsername.js
const User = require('../../models/user.model');

/**
 * Generates a short, unique username from email address
 * Returns usernames between 3-12 characters
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
      .slice(0, 8); // Keep only first 8 chars max for base

    // Handle empty or invalid baseUsername
    if (!baseUsername || baseUsername.length < 2) {
      baseUsername = 'usr';
    }

    // Function to check if username exists
    const isUsernameTaken = async (username) => {
      const existingUser = await User.findOne({ username });
      return !!existingUser;
    };

    // Function to generate a random string
    const generateRandomString = (length = 2) => {
      const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    // Ensure minimum length
    if (baseUsername.length < 3) {
      baseUsername = baseUsername.padEnd(3, generateRandomString(3 - baseUsername.length));
    }

    // Try different username generation strategies
    let username = baseUsername;
    let attempts = 0;
    const maxAttempts = 10;

    while (await isUsernameTaken(username) && attempts < maxAttempts) {
      attempts++;

      // Add 2-4 random characters based on attempt number
      const suffixLength = Math.min(2 + Math.floor(attempts / 3), 4);
      const randomSuffix = generateRandomString(suffixLength);

      // Keep base length shorter as suffix grows
      const maxBaseLength = Math.max(3, 8 - suffixLength);
      const trimmedBase = baseUsername.slice(0, maxBaseLength);

      username = `${trimmedBase}${randomSuffix}`;
    }

    // Last resort: Create a very short random username
    if (await isUsernameTaken(username)) {
      const shortBase = baseUsername.slice(0, 3);
      const timestamp = Date.now().toString().slice(-3);
      username = `${shortBase}${timestamp}`;
    }

    // Final validation
    if (username.length < 3 || username.length > 12) {
      throw new Error('Generated username does not meet length requirements');
    }

    return username;
  } catch (error) {
    console.error('Username generation error:', error);
    throw new Error(`Failed to generate username: ${error.message}`);
  }
};

module.exports = generateUsername;
