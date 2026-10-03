import type { ApiErrorCode } from '../../../packages/contracts/src/product.ts';

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    public readonly status: number,
    message: string,
    public readonly retryable = false,
  ) {
    super(message);
  }
}
