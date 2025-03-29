import WalletSecurity from '../xion/WalletSecurity';
import { User } from '../models/user.model';
import QRCode from 'qrcode';

export const setupGoogleAuth = async (req, res) => {
  try {
    const { userId } = req.authToken;
    const user = await User.findById(userId);

    if (user.security?.isGoogleAuthEnabled) {
      return res.status(400).json({
        success: false,
        message: 'Google Authenticator is already enabled'
      });
    }

    const secret = WalletSecurity.generateTOTPSecret();
    const qrCodeUrl = WalletSecurity.generateQRCodeURL(user.email, secret);
    const qrCodeImage = await QRCode.toDataURL(qrCodeUrl);

    // Store temporarily for verification
    req.session.tempGoogleAuthSecret = secret;

    res.json({
      success: true,
      data: {
        qrCode: qrCodeImage,
        secret
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const verifyAndEnableGoogleAuth = async (req, res) => {
  try {
    const { token } = req.body;
    const { userId } = req.authToken;
    const secret = req.session.tempGoogleAuthSecret;

    if (!secret) {
      return res.status(400).json({
        success: false,
        message: 'Setup process not initiated'
      });
    }

    const isValid = WalletSecurity.verifyTOTP(token, secret);
    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token'
      });
    }

    await User.findByIdAndUpdate(userId, {
      'security.isGoogleAuthEnabled': true,
      'security.googleAuthSecret': secret,
      $addToSet: { 'security.requiredAuthMethods': 'GOOGLE_AUTH' }
    });

    delete req.session.tempGoogleAuthSecret;

    res.json({
      success: true,
      message: 'Google Authenticator enabled successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const setupPasscode = async (req, res) => {
  try {
    const { passcode } = req.body;
    const { userId } = req.authToken;

    const { hash, salt } = await WalletSecurity.hashPasscode(passcode);

    await User.findByIdAndUpdate(userId, {
      'security.passcodeHash': hash,
      'security.passcodeSalt': salt,
      $addToSet: { 'security.requiredAuthMethods': 'PASSCODE' }
    });

    res.json({
      success: true,
      message: 'Passcode set successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export const enableBiometric = async (req, res) => {
  try {
    const { userId } = req.authToken;

    await User.findByIdAndUpdate(userId, {
      'security.isBiometricEnabled': true,
      $addToSet: { 'security.requiredAuthMethods': 'BIOMETRIC' }
    });

    res.json({
      success: true,
      message: 'Biometric authentication enabled'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
