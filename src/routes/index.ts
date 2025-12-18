import express from 'express';
import authenticator from '../middleware/authenticator';
import fundRouter from './fundRouter';
import recordRouter from './recordRouter';
import userRouter from './userRouter';

const router = express.Router();

router.use(authenticator);
router.use('/user/', userRouter);
router.use('{/public}/fund', fundRouter);
router.use('{/public}/record', recordRouter);
router.use('/', (req, res) => res.sendStatus(404));

export default router;