import express from 'express';
import userHandler from '../controllers/userController';

const router = express.Router();

router.delete('/', userHandler.destroy);

export default router;