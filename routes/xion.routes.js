import express from 'express';
import { transferFunds, getBalance, getTransactions, getNFTs } from '../controller/xion.controller.js';

const router = express.Router();

// Transfer funds between wallets
router.post('/transfer', transferFunds);

// Get wallet balance
router.get('/balance/:address',getBalance);

// Get transaction history
router.get('/transactions/:address',  getTransactions);

// Get NFTs for a wallet
router.get('/nfts/:walletAddress/:contractAddress',  getNFTs);

export default router;
