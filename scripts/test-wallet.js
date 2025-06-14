import { ec, stark, CallData } from 'starknet';
import crypto from 'crypto';
import dotenv from 'dotenv';
import StarknetService, { starknetService } from '../services/starknet.service.js';

dotenv.config();

// Encryption functions
const generateEncryptionKey = (secret, salt) => {
  return crypto.pbkdf2Sync(secret, salt, 100000, 32, 'sha256');
};

const encrypt = (data, secret) => {
  const salt = crypto.randomBytes(16);
  const key = generateEncryptionKey(secret, salt);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(data, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return {
    encrypted,
    salt: salt.toString('hex'),
    iv: iv.toString('hex')
  };
};

const decrypt = (encryptedData, secret, salt, iv) => {
  const key = generateEncryptionKey(secret, Buffer.from(salt, 'hex'));
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    key,
    Buffer.from(iv, 'hex')
  );

  let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
};

// Test wallet creation and encryption
const testWalletCreation = async () => {
  try {
    // Generate a new key pair
    const privateKey = stark.randomAddress();
    const publicKey = ec.starkCurve.getStarkKey(privateKey);

    // Calculate the future address of the Argent account
    const starknetService = new StarknetService();
    const constructorCalldata = CallData.compile({
      owner: publicKey,
      guardian: '0x0' // No guardian initially
    });

    // Encrypt the private key
    const serverSecret = process.env.SERVER_SECRET || 'your-secret-key';
    const encryptedPrivateKey = encrypt(privateKey, serverSecret);

    console.log('Generated Wallet Info:');
    console.log('Public Key:', publicKey);
    console.log('Private Key:', privateKey);
    console.log('\nEncrypted Wallet Info:');
    console.log('Encrypted Private Key:', encryptedPrivateKey);

    // Test decryption
    const decryptedPrivateKey = decrypt(
      encryptedPrivateKey.encrypted,
      serverSecret,
      encryptedPrivateKey.salt,
      encryptedPrivateKey.iv
    );

    console.log('\nDecryption Test:');
    console.log('Decrypted Private Key:', decryptedPrivateKey);
    console.log('Decryption Successful:', decryptedPrivateKey === privateKey);

  } catch (error) {
    console.error('Error in wallet creation test:', error);
  }
};

const makewallet = async () => {
   const wallet = await starknetService.createUserWallet("joseph@gmail.com")
}

// Run the test
testWalletCreation();
