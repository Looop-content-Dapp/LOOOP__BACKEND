const express = require('express');
const { getUserTransactions, getTransactionById } = require('../controller/transaction.controller');
const { authenticateAPIRequest } = require('../middlewares/authenticaterequest.middleware');

const router = express.Router();

router.get('/user/:userId', getUserTransactions);
router.get('/:transactionId',getTransactionById);

module.exports = router;
