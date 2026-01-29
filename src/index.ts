import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import router from './routes/index';
import errorHandler from './middleware/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/api', router);
app.use(errorHandler);

export default app;
