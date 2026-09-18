import { Request, Response, NextFunction } from 'express';

const convertBigIntToString = (obj: any): any => {
  if (typeof obj === 'bigint') {
    return obj.toString();
  }

  if (obj instanceof Date) {
    return obj.toISOString();
  }

  // Prisma Decimal / decimal-like objects
  if (
    obj !== null &&
    typeof obj === 'object' &&
    typeof obj.toNumber === 'function' &&
    typeof obj.toString === 'function'
  ) {
    const numericValue = obj.toNumber();
    return Number.isFinite(numericValue) ? numericValue : obj.toString();
  }
  
  if (Array.isArray(obj)) {
    return obj.map(convertBigIntToString);
  }
  
  if (obj !== null && typeof obj === 'object') {
    const converted: any = {};
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        converted[key] = convertBigIntToString(obj[key]);
      }
    }
    return converted;
  }
  
  return obj;
};

export const bigintSerializerMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const originalJson = res.json;
  
  res.json = function(body: any) {
    const convertedBody = convertBigIntToString(body);
    return originalJson.call(this, convertedBody);
  };
  
  next();
};
