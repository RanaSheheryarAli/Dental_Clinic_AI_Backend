export class AppError extends Error {
  code: string;
  httpStatus: number;

  constructor(code: string, message: string, httpStatus = 500) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.httpStatus = httpStatus;
  }
}
