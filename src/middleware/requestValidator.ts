import { Request, Response, NextFunction } from 'express';
import { SchemaValidator } from '../types';
import Fund from '../models/fundModel';
import Record from '../models/recordModel';

type PayloadKey = 'body' | 'params' | 'query';
type Entity = Fund | Record;

const findScript = (req: Request, keys: PayloadKey[]) => keys.some((key) => {
  return JSON.stringify(req[key])?.includes('<script>')
});

const findInvalidKey = (payload: Partial<Entity>, schema: SchemaValidator<Entity>) => {
  return Object.keys(payload).find(key => !(key in schema));
};

const findFailedTest = (payload: Partial<Entity>, schema: SchemaValidator<Entity>) => {
  const tests = Object.entries(schema);
  const failedTest = tests.find(([key, value]) => {
    const test = value as (val: any) => boolean;
    const validValue = test(payload[key as keyof Entity]);
    return !validValue;
  });
  return failedTest;
};

function validate(schemaValidator: SchemaValidator<Entity>) {

  return (req: Request, res: Response, next: NextFunction) => {

    const payloadKeys = Object.keys(schemaValidator) as PayloadKey[];
    const includesScript = findScript(req, payloadKeys);

    if (includesScript) return res
      .status(400)
      .json({ message: 'Invalid input' });

    for (const payloadKey of payloadKeys) {
      const schema = schemaValidator[payloadKey] as SchemaValidator<Entity>;
      const payload = req[payloadKey] || {};
      const invalidKey = findInvalidKey(payload, schema);

      if (invalidKey) return res
        .status(400)
        .json({ message: `Invalid key: "${invalidKey}"`});

      const failedTest = findFailedTest(payload, schema);

      if (failedTest) {
        const [invalidValue] = failedTest;
        return res
          .status(400)
          .json({ message: `"${invalidValue}" Cannot be "${payload[invalidValue]}"` });
      }
    }
    next()
  }
}

export default validate;