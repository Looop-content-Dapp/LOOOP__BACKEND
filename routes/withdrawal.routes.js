import { Router } from 'express';
import { requestWithdrawal } from '../controller/withdrawal.controller.js';
import { isValidArtist } from '../middlewares/isvalidartist.middleware.js';

const withdrawalRouter = Router();

withdrawalRouter.post('/request', isValidArtist, requestWithdrawal);

export default withdrawalRouter; 