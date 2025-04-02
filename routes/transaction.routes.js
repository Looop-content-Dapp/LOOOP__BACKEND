import { Router } from 'express';
import { getUserTransactions, getTransactionById } from '../controller/transaction.controller.js';

const transactionrouter = Router();

transactionrouter.get('/user/:userId', getUserTransactions);
transactionrouter.get('/:transactionId', getTransactionById);

export default transactionrouter;
