import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import router from './routes/index';
import errorHandler from './middleware/errorHandler';
import sequelize from './config/sequelize';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));
app.use('/api', router);
app.use(errorHandler);

if (process.env.NODE_ENV = 'development') {
  const initializeDatabase = async () => {
    try {
      await sequelize.authenticate();
      console.log('Database connected.');
    } catch (error) {
      throw new Error('Unable to connect to the database.');
    }
  };

  const startServer = async () => {
    try {
      const port = process.env.PORT || 3000;
      await initializeDatabase();
      app.listen(port, () => console.log(`Server on port ${port}`));
    } catch (error) {
      return console.error(error);
    }
  };

  startServer();
}

export default app;
