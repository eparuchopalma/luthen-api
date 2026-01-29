import { Sequelize } from 'sequelize-typescript';
import { dbConfig } from '.';
import pg from 'pg';
import Fund from '../models/fundModel';
import Record from '../models/recordModel';

const sequelize = new Sequelize({
  ...dbConfig,
  dialect: 'postgres',
  dialectModule: pg,
  dialectOptions: {
    ssl: process.env.NODE_ENV === 'production'
  },
  logging: console.log,
  models: [Fund, Record],
});

export default sequelize;