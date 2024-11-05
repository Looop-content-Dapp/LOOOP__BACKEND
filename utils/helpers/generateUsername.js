// utils/helpers/generateUsername.js
const User = require('../../models/user.model');

/**
 * Generates a unique username from any email address format
 * Handles various email patterns and ensures uniqueness
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
      // Remove dots
      .replace(/\./g, '')
      // Replace special characters with underscore
      .replace(/[^a-zA-Z0-9]/g, '_')
      // Convert to lowercase
      .toLowerCase()
      // Remove consecutive underscores
      .replace(/_+/g, '_')
      // Remove leading/trailing underscores
      .replace(/^_+|_+$/g, '');

    // Handle empty or invalid baseUsername
    if (!baseUsername || baseUsername.length < 2) {
      baseUsername = 'user';
    }

    // Function to check if username exists
    const isUsernameTaken = async (username) => {
      const existingUser = await User.findOne({ username });
      return !!existingUser;
    };

    // Function to generate a random string with configurable character sets
    const generateRandomString = (length = 3, useSpecialChars = false) => {
      let chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
      if (useSpecialChars) {
        chars += '_';
      }
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    // Ensure username meets minimum length
    if (baseUsername.length < 3) {
      baseUsername = baseUsername.padEnd(3, generateRandomString(3 - baseUsername.length));
    }

    // Try different username generation strategies
    let username = baseUsername;
    let attempts = 0;
    let maxAttempts = 15; // Increased max attempts for better coverage

    while (await isUsernameTaken(username) && attempts < maxAttempts) {
      attempts++;

      switch (true) {
        case attempts <= 3:
          // First strategy: Add random numbers
          const randomNum = Math.floor(Math.random() * 999).toString().padStart(3, '0');
          username = `${baseUsername}${randomNum}`;
          break;

        case attempts <= 6:
          // Second strategy: Add random letters
          const randomLetters = generateRandomString(4, false);
          username = `${baseUsername}${randomLetters}`;
          break;

        case attempts <= 9:
          // Third strategy: Mix numbers and letters with underscore
          const mixedString = generateRandomString(4, true);
          username = `${baseUsername}_${mixedString}`;
          break;

        default:
          // Final strategy: Timestamp + random string for guaranteed uniqueness
          const timestamp = Date.now().toString().slice(-4);
          const randomSuffix = generateRandomString(2, true);
          username = `${baseUsername}${timestamp}${randomSuffix}`;
      }

      // Ensure username length is appropriate (3-20 characters)
      if (username.length > 20) {
        // If too long, trim the base and add unique identifier
        const trimmedBase = baseUsername.slice(0, 12);
        const uniqueSuffix = `_${timestamp.slice(-4)}${generateRandomString(2)}`;
        username = trimmedBase + uniqueSuffix;
      }
    }

    // Last resort: If still not unique, create a completely random username
    if (await isUsernameTaken(username)) {
      const timestamp = Date.now().toString().slice(-6);
      const randomStr = generateRandomString(4, true);
      username = `user_${timestamp}${randomStr}`;
    }

    // Final validation
    if (username.length < 3 || username.length > 20) {
      throw new Error('Generated username does not meet length requirements');
    }

    // Log success for debugging (remove in production)
    console.log(`Generated username '${username}' from email '${email}'`);

    return username;
  } catch (error) {
    console.error('Username generation error:', error);
    throw new Error(`Failed to generate username: ${error.message}`);
  }
};

module.exports = generateUsername;
