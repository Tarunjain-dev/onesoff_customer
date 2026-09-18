declare module 'multer' {
  import { RequestHandler } from 'express';

  type FileFilterCallback = (error: Error | null, acceptFile?: boolean) => void;

  interface Multer {
    single(fieldName: string): RequestHandler;
    array(fieldName: string, maxCount?: number): RequestHandler;
    fields(fields: ReadonlyArray<{ name: string; maxCount?: number }>): RequestHandler;
    any(): RequestHandler;
    none(): RequestHandler;
  }

  interface Options {
    storage?: unknown;
    fileFilter?: (req: any, file: Express.Multer.File, cb: FileFilterCallback) => void;
    limits?: {
      fileSize?: number;
      [key: string]: number | undefined;
    };
  }

  function multer(options?: Options): Multer;

  namespace multer {
    function memoryStorage(): unknown;
  }

  export = multer;
}

declare global {
  namespace Express {
    namespace Multer {
      interface File {
        fieldname: string;
        originalname: string;
        encoding: string;
        mimetype: string;
        size: number;
        buffer: Buffer;
        destination?: string;
        filename?: string;
        path?: string;
      }
    }

    interface Request {
      file?: Multer.File;
      files?:
        | Multer.File[]
        | {
            [fieldname: string]: Multer.File[];
          };
    }
  }
}

export {};
