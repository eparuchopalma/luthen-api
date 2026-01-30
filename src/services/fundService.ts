import { EmptyResultError, Transaction, ValidationError, Op } from 'sequelize';
import sequelize from '../config/sequelize';
import fundModel from '../models/fundModel';
import recordModel from '../models/recordModel';
import RedisClient from '../config/redis';

const redisClient = new RedisClient;
const { Fund, Record } = sequelize.models;

type Payload = Partial<fundModel>;

class FundService {
  constructor() {}

  async create(payload: Payload) {
    const transaction = await sequelize.transaction();
    try {
      const data = await Fund!.create(payload, { raw: true, transaction });
      delete data.dataValues.user_id;
      await updateCache(payload.user_id!);
      await transaction.commit();
      return data;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async destroy({ id, user_id }: Payload) {
    const fund = await Fund!.findOne({ where: { id, user_id } });
    if (!fund) throw new EmptyResultError('Fondo no encontrado');
    if (fund.dataValues.is_main)
      throw new ValidationError('El fondo principal no debe ser eliminado', []);

    const mainFund = await Fund!.findOne({ where: { user_id, is_main: true }});
    if (!mainFund) throw new EmptyResultError('Fondo principal no encontrado');

    const transaction = await sequelize.transaction();
    try {
      const fund_id = fund.dataValues.id;
      const mainFundID = mainFund.dataValues.id;
      await deleteNonConflictingRecords(fund_id, mainFundID, transaction);
      await reassignRecords(fund_id, mainFundID, transaction);
      await updateFundBalance(mainFundID, transaction);
      await fund.destroy({ transaction });
      await updateCache(user_id!);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    } 
  }

  async read({ user_id }: Payload) {
    const fundsOnCache = await redisClient.read(user_id!);

    if (fundsOnCache) return fundsOnCache;

    const fundsOnDB = await Fund!.findAll({
      attributes: { exclude: ['user_id'] },
      order: [['name', 'ASC']],
      raw: true,
      where: { user_id },
    }) as fundModel[];

    if (fundsOnDB.length) {
      await updateCache(user_id!, fundsOnDB);
      return fundsOnDB;
    }

    const transaction = await sequelize.transaction();
    try {
      const mainFund = await this.create({
        name: 'Main', is_main: true, user_id, balance: 0
      }) as fundModel;
      await updateCache(user_id!, [mainFund]);
      await transaction.commit();
      return [mainFund];
    } catch (error) {
      transaction.rollback();
      throw error;
    }
  }

  async update({ id, user_id, ...fields }: Payload) {
    const fund = await Fund!.findOne({ where: { id, user_id } });
    if (!fund) throw new EmptyResultError('Fondo no encontrado');
    else {
      const transaction = await sequelize.transaction();
      try {
        const updatedFund = await fund.update(fields, { transaction });
        await updateCache(user_id!);
        await transaction.commit();
        return updatedFund;
      } catch (error) {
        await transaction.rollback();
      }
    }
  }
}

async function reassignRecords(
  fund_id: string,
  mainFundID: string,
  transaction: Transaction
) {
  await Record!.update({ fund_id: mainFundID }, { where: { fund_id }, transaction });
  await Record!.update({
    correlated_fund_id: mainFundID
  }, { where: { correlated_fund_id: fund_id }, transaction, });
  return;
}

async function deleteNonConflictingRecords(
  fund_id: string,
  mainFundID: string,
  transaction: Transaction
) {
  return await Record!.destroy({
    where: {
      fund_id: {
        [Op.or]: [fund_id, mainFundID]
      },
      correlated_fund_id: {
        [Op.or]: [fund_id, mainFundID]
      }
    },
    transaction,
  });
}

async function updateFundBalance(fund_id: string, transaction: Transaction) {
  const records = await Record!.findAll({
    where: { [Op.or]: [{ fund_id }, { correlated_fund_id: fund_id }] },
    raw: true,
    transaction
  }) as recordModel[];

  records.sort((a, b) => new Date(a.date!) > new Date(b.date!) ? 1 : -1);
  const balance = records.reduce((balance, r) => {
    const receivesFromFund = fund_id === r.correlated_fund_id;
    const result = balance + (receivesFromFund ? -Number(r.amount) : Number(r.amount));
    return result;
  }, 0);

  return await Fund!.update({ balance }, { where: { id: fund_id }, transaction });
}

export async function updateCache(user_id: string, funds?: fundModel[]) {
  if (funds) return await redisClient.write(user_id!, funds);
  const fundsOnDB = await Fund!.findAll({
    attributes: { exclude: ['user_id'] },
    order: [['name', 'ASC']],
    raw: true,
    where: { user_id }
  });
  return await redisClient.write(user_id!, fundsOnDB);
}

export default FundService;