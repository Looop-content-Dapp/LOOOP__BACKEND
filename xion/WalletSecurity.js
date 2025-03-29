import crypto from 'crypto';
import { authenticator } from 'otplib';
import { User } from '../models/user.model.js';

class WalletSecurity {
  constructor() {
    this.authenticator = authenticator;
    // Configure TOTP settings
    this.authenticator.options = {
      step: 30,
      window: 1
    };
  }

  // Generate new TOTP secret for Google Authenticator
  generateTOTPSecret() {
    return this.authenticator.generateSecret();
  }

  // Verify TOTP token
  verifyTOTP(token, secret) {
    return this.authenticator.verify({ token, secret });
  }

  // Generate QR code secret URL for Google Authenticator
  generateQRCodeURL(email, secret) {
    return this.authenticator.keyuri(email, 'LOOOP Wallet', secret);
  }

  // Hash passcode
  async hashPasscode(passcode) {
    const salt = crypto.randomBytes(16);
    const hash = await new Promise((resolve, reject) => {
      crypto.pbkdf2(passcode, salt, 100000, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        resolve(derivedKey);
      });
    });
    return {
      hash: hash.toString('hex'),
      salt: salt.toString('hex')
    };
  }

  // Verify passcode
  async verifyPasscode(passcode, storedHash, storedSalt) {
    const hash = await new Promise((resolve, reject) => {
      crypto.pbkdf2(passcode, Buffer.from(storedSalt, 'hex'), 100000, 64, 'sha512', (err, derivedKey) => {
        if (err) reject(err);
        resolve(derivedKey);
      });
    });
    return hash.toString('hex') === storedHash;
  }
}

export default new WalletSecurity();
