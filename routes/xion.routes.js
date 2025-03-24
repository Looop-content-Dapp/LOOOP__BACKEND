import express from 'express';
import { transferFunds, getBalance, getTransactions, getNFTs } from '../controller/xion.controller.js';
import { authenticateAPIRequest } from '../middlewares/authenticaterequest.middleware.js';

const router = express.Router();

// Transfer funds between wallets
router.post('/transfer', authenticateAPIRequest, transferFunds);

// Get wallet balance
router.get('/balance/:address', authenticateAPIRequest, getBalance);

// Get transaction history
router.get('/transactions/:address', authenticateAPIRequest, getTransactions);

// Get NFTs for a wallet
router.get('/nfts/:walletAddress/:contractAddress', authenticateAPIRequest, getNFTs);

export default router;
