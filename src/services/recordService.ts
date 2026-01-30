import { ValidationError, EmptyResultError, Op, Transaction } from 'sequelize';
import sequelize from '../config/sequelize';
import recordModel from '../models/recordModel';
import fundModel from '../models/fundModel';
import { updateCache } from './fundService';

type Payload = Partial<recordModel>;

enum RecordType {
  credit = 1,
  debit = 2,
  fund2fund = 0
};

const { Fund, Record } = sequelize.models;

class RecordService {
  public async create(payload: Payload) {
    const { amount, correlated_fund_id, date, fund_id, type, user_id } = payload;
    checkAmount(payload);
    checkCorrelatedFund(payload);
    const transaction = await sequelize.transaction();
    try {
      await testDate(date!, user_id!);
      await validateFund(fund_id!, user_id!);
      if (type === RecordType.fund2fund) await validateCorrelated(correlated_fund_id!, user_id!);
      if (type !== RecordType.credit) await testBalance(fund_id!, payload);

      await Record!.create(payload, { transaction });

      const data = [];
      const fund = await Fund!.increment({
        balance: amount
      }, { where: { id: fund_id, user_id }, transaction })
        .then(result => {
          const [fund] = result.flat(2) as [fundModel, number];
          delete fund.user_id;
          return fund;
        })

      data.push(fund);

      if (type === RecordType.fund2fund) {
        const correlatedFund = await Fund!.increment({
          balance: -Number(amount)
        }, { transaction, where: { id: correlated_fund_id, user_id }})
          .then(result => {
            const [correlatedFund] = result.flat(2) as [fundModel, number];
            delete correlatedFund.user_id
            return correlatedFund;
          })
        data.push(correlatedFund);
      }
      await updateCache(user_id!);
      await transaction.commit();
      return data;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  public async destroy(payload: Payload) {
    const record = await Record!
      .findOne({ where: { id: payload.id, user_id: payload.user_id } });

    if (!record) throw new EmptyResultError('Registro no encontrado.');

    const transaction = await sequelize.transaction();
    try {
      const data = [];
      const { amount, correlated_fund_id, fund_id, type } = record.dataValues;
      if (type === RecordType.credit) {
        await testBalance(fund_id, record.dataValues, false);
      } else if (type === RecordType.fund2fund) {
        await testBalance(correlated_fund_id, record.dataValues, false);
        const correlatedFund = await Fund!.increment({ balance: amount}, {
          where: {
            id: record.dataValues.correlated_fund_id,
            user_id: payload.user_id
          }, transaction })
            .then(result => {
              const [correlatedFund] = result.flat(2) as [fundModel, number];
              delete correlatedFund.user_id;
              return correlatedFund;
            });

          data.push(correlatedFund);

      }

      const fund = await Fund!.increment({ balance: -Number(amount)}, {
        where: {
          id: record.dataValues.fund_id,
          user_id: payload.user_id
        }, transaction })
          .then(result => {
            const [fund] = result.flat(2) as [fundModel, number];
            delete fund.user_id;
            return fund;
          })

      data.push(fund);
      await record.destroy({ transaction });
      await updateCache(payload.user_id!);
      await transaction.commit();
      return data;
    } catch (error) {
      transaction.rollback();
      throw error;
    }
  }

  public async read({ user_id, ...filters }: Payload & { fromDate?: Date, toDate?: Date }) {
    normalizeFilters(filters);
    const data = await Record!.findAll({
      attributes: { exclude: ['user_id'] },
      order: [['date', 'ASC']],
      raw: true,
      where: { user_id, ...filters },
    });
    return data;
  }

  public async update(payload: Payload) {
    const recordStored = await Record!.findOne({
      where: { id: payload.id, user_id: payload.user_id }
    }) as recordModel;
    if (!recordStored) throw new EmptyResultError('Registro original no encontrado.');

    const updateKeys = getUpdateKeys(recordStored.dataValues, payload);
    if (updateKeys.length === 0) throw new ValidationError('Nada que actualizar.', []);

    const textKeys = ['note', 'tag'];
    const onlyTextKeys = updateKeys.every(key => textKeys.includes(key));
    
    if (onlyTextKeys) {
      const data = await recordStored.update(payload);
      delete data.dataValues.user_id
      return {
        record: data.dataValues,
        funds: []
      }
    }

    if (payload.date !== undefined) await testDate(payload.date, payload.user_id!);

    if (payload.type !== undefined || payload.fund_id !== undefined) {
      const type = payload.type ?? recordStored.dataValues.type;
      const payloadFund = payload.fund_id
        ? await validateFund(payload.fund_id, payload.user_id!)
        : null;

      if (type === RecordType.credit) {
        const fund = payloadFund || await validateFund(recordStored.dataValues.fund_id, payload.user_id!);
        if (!fund.dataValues.is_main) {
          throw new ValidationError('Los créditos deben asociarse al fondo principal.', []);
        }
      }
    }

    if (payload.correlated_fund_id) validateFund(payload.correlated_fund_id, payload.user_id!);

    const recordEdited = { ...recordStored.dataValues, ...payload };

    checkAmount(recordEdited);
    checkCorrelatedFund(recordEdited);

    const transaction = await sequelize.transaction();

    try {
      const funds = await handleBalanceUpdate(recordStored.dataValues, recordEdited, transaction);
      const record = await recordStored.update(payload, { transaction });
      delete record.dataValues.user_id;
      if (funds.length) await updateCache(payload.user_id!);
      await transaction.commit();
      const data = { record: record.dataValues, funds };
      return data;
    } catch (error) {
      transaction.rollback();
      throw error;
    }
  }

}

function formatDate(date: Date) {
  return new Intl
    .DateTimeFormat('es-VE', { weekday: "long", year: "numeric", month: "short", day: "numeric", hour: '2-digit', minute: '2-digit' })
    .format(new Date(date))
}

function formatAmount(amount: number) {
  return new Intl
    .NumberFormat('en-US', { style: 'currency', currency: 'USD' })
    .format(amount)
  return Number(amount).toFixed(2);
}

async function testDate(date: Date, user_id: string) {
  checkFutureDate(date);
  await checkDateIsFree({ date, user_id });
}

function checkAmount(payload: Payload) {
  if (payload.type === RecordType.credit && Number(payload.amount) <= 0) {
    throw new ValidationError('El monto debe ser positivo para créditos.', []);
  } else if (payload.type !== RecordType.credit && Number(payload.amount) >= 0) {
    throw new ValidationError('El monto debe ser negativo para débitos.', []);
  }
}

function checkCorrelatedFund(payload: Payload) {
  if (payload.type === RecordType.fund2fund && !payload.correlated_fund_id) {
    throw new ValidationError('Para el tipo de registro, es requerido el campo de fondo correlacionado.', []);
  } else if (payload.type !== RecordType.fund2fund && payload.correlated_fund_id) {
    throw new ValidationError('El campo de fondo correlacionado solo es permitido para registros de fondo a fondo.', []);
  } else if (payload.fund_id === payload.correlated_fund_id) {
    throw new ValidationError('Los fondos tienen el mismo valor.', []);
  }
  return;
}

function checkFutureDate(date: Date) {
  if (new Date(date) > new Date()) {
    throw new ValidationError('La fecha no puede estar indicada en el futuro.', []);
  } else return;
}

async function checkDateIsFree({ date, user_id }: { date: Date, user_id: string }) {
  const recordOnDate = await Record!.findOne({ where: { date, user_id } });
  if (recordOnDate) throw new ValidationError('La fecha indicada ya posee un registro.', []);
}

async function handleBalanceUpdate(
  original: recordModel,
  payload: recordModel,
  transaction: Transaction
) {

  const fundsToTest = [original.fund_id];

  if (original.correlated_fund_id) fundsToTest.push(original.correlated_fund_id);
  if (!fundsToTest.includes(payload.fund_id)) fundsToTest.push(payload.fund_id);
  if (payload.correlated_fund_id && !fundsToTest.includes(payload.correlated_fund_id)) fundsToTest.push(payload.correlated_fund_id);

  const updatedFunds = [];

  for (const fundID of fundsToTest) {
    const response = await updateFundBalance(fundID, original, payload, transaction)
    if (response) {
      const updatedFund = response.flat(2)[0] as fundModel;
      delete updatedFund?.user_id;
      updatedFunds.push(updatedFund);
    }
  }

  return updatedFunds;
}

async function updateFundBalance(
  fund_id: string,
  original: recordModel,
  payload: recordModel,
  transaction: Transaction
) {
  const originalAmountOnFund = getRecordEffectOnFund(fund_id, original);
  const payloadAmountOnFund = getRecordEffectOnFund(fund_id, payload);
  const payloadDateIsNewer = new Date(payload.date) > new Date(original.date);
  const payloadDiff = -Number(originalAmountOnFund) + Number(payloadAmountOnFund);
  const payloadDecrements = payloadDiff < 0;

  if (payloadDecrements || payloadDateIsNewer) await testBalance(fund_id, payload);

  if (payloadDiff !== 0) return await Fund!.increment({
    balance: payloadDiff
  }, { where: { id: fund_id }, transaction });

  return;
}

function getRecordEffectOnFund(fund_id: string, record: recordModel) {
  if (fund_id === record.fund_id) return record.amount;
  else if (fund_id === record.correlated_fund_id) return -Number(record.amount);
  else return 0;
}

async function testBalance(fund_id: string, payload: Payload, includingPayload = true) {
  const fundRecords = await getFundRecords(fund_id, payload.id) as Payload[];
  const payloadIsRelated = [payload.fund_id, payload.correlated_fund_id]
    .includes(fund_id);

  if (includingPayload && payloadIsRelated) fundRecords.push(payload);

  fundRecords.sort((a, b) => new Date(a.date!) > new Date(b.date!) ? 1 : -1);

  const balance = fundRecords.reduce((balance, r) => {
    const receivesFromFund = fund_id === r.correlated_fund_id;
    const result = balance + (receivesFromFund ? -Number(r.amount) : Number(r.amount));

    if (result < 0) {
      const message = `Esto afecta la consistencia de sus registros.
      \El ${formatDate(r.date!)}, ` +
        `el balance del fondo (${formatAmount(balance)}) ` +
        `no pudiera cubrir un registro de ${formatAmount(r.amount!)}.`;
      throw new ValidationError(message, []);
    }

    return result;
  }, 0);
  return balance;
}

function getUpdateKeys(recordStored: recordModel, payload: Payload) {
  return Object
    .keys(payload)
    .filter((key) => {
      const k = key as keyof Payload;
      let notEqual;
      if (k === 'amount') notEqual = Number(recordStored[k]) !== Number(payload[k]);
      else if (k === 'date') notEqual = recordStored[k]
        .toISOString() !== (new Date(payload[k]!) as Date).toISOString();
      else notEqual = recordStored[k] !== payload[k];
      return notEqual;
    });
}

function getFundRecords(fund_id: string, exceptID?: string) {
  const filters: any = { [Op.or]: [{ fund_id }, { correlated_fund_id: fund_id }] };
  if (exceptID) filters.id = { [Op.ne]: exceptID };
  return Record!.findAll({ where: filters, raw: true });
}

function normalizeFilters(filters: any) {
  if (filters.fromDate || filters.toDate) setDateFilter(filters);
  if (filters.note) setNoteFilter(filters);
  if (filters.fund_id) setFundFilter(filters);
}

function setDateFilter(filters: any) {
  if (filters.fromDate && filters.toDate) {
    filters.date = { [Op.between]: [filters.fromDate, filters.toDate] };
    delete filters.fromDate;
    delete filters.toDate;
  } else if (filters.fromDate) {
    filters.date = { [Op.gte ]: filters.fromDate }
    delete filters.fromDate;
  } else {
    filters.date = { [Op.lte ]: filters.toDate }
    delete filters.toDate;
  }
}

function setNoteFilter(filters: any) {
  filters.note = { [Op.like]: `%${filters.note}%` };
}

function setFundFilter(filters: any) {
  filters[Op.or] = [
    { fund_id: filters.fund_id },
    { correlated_fund_id: filters.fund_id }
  ];
  delete filters.fund_id;
}

async function validateFund(id: string, user_id: string) {
  const fund = await Fund!.findOne({ where: { id, user_id } });
  if (!fund) throw new EmptyResultError('Fondo no encontrado.');
  return fund;
}

async function validateCorrelated(id: string, user_id: string) {
  const correlatedFund = await Fund!.findOne({ where: { id, user_id } });
  if (!correlatedFund) throw new EmptyResultError('Fondo no encontrado.');
  return correlatedFund;
}

export default RecordService;