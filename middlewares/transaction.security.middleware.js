import WalletSecurity from '../xion/WalletSecurity';
import { User } from '../models/user.model';

export const verifyTransactionSecurity = async (req, res, next) => {
  try {
    const { userId } = req.authToken;
    const { googleAuthToken, passcode, biometricToken } = req.body;

    const user = await User.findById(userId).select('+security.googleAuthSecret +security.passcodeHash +security.passcodeSalt');
    const requiredMethods = user.security?.requiredAuthMethods || [];

    // Verify each required authentication method
    for (const method of requiredMethods) {
      switch (method) {
        case 'GOOGLE_AUTH':
          if (!googleAuthToken || !WalletSecurity.verifyTOTP(googleAuthToken, user.security.googleAuthSecret)) {
            return res.status(401).json({
              success: false,
              message: 'Invalid Google Authenticator code'
            });
          }
          break;

        case 'PASSCODE':
          if (!passcode || !await WalletSecurity.verifyPasscode(
            passcode,
            user.security.passcodeHash,
            user.security.passcodeSalt
          )) {
            return res.status(401).json({
              success: false,
              message: 'Invalid passcode'
            });
          }
          break;

        case 'BIOMETRIC':
          // Biometric verification should be handled on the client side
          if (!biometricToken) {
            return res.status(401).json({
              success: false,
              message: 'Biometric verification required'
            });
          }
          break;
      }
    }

    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};
