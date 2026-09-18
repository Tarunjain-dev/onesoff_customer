import { Response } from 'express';
import { sanitizeClientErrorMessage } from './clientErrorMessage';

export const ApiResponse = {
  success(res: Response, data: any = null, message: string = 'Success', statusCode: number = 200) {
    return res.status(statusCode).json({
      success: true,
      message,
      data
    });
  },

  error(res: Response, message: unknown = 'Error', statusCode: number = 400, errors: any = null) {
    return res.status(statusCode).json({
      success: false,
      message: sanitizeClientErrorMessage(message, 'Something went wrong. Please try again.'),
      errors
    });
  },

  unauthorized(res: Response, message: string = 'Unauthorized') {
    return res.status(401).json({
      success: false,
      message
    });
  },

  forbidden(res: Response, message: string = 'Forbidden') {
    return res.status(403).json({
      success: false,
      message
    });
  },

  notFound(res: Response, message: string = 'Not found') {
    return res.status(404).json({
      success: false,
      message
    });
  }
};
