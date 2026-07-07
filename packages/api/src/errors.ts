export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code: string = 'api_error',
    public severity: ErrorSeverity = 'medium',
    public details?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static badRequest(message: string, details?: unknown): ApiError {
    return new ApiError(400, message, 'bad_request', 'low', details);
  }

  static unauthorized(message = 'Unauthorized'): ApiError {
    return new ApiError(401, message, 'unauthorized', 'low');
  }

  static forbidden(message = 'Forbidden'): ApiError {
    return new ApiError(403, message, 'forbidden', 'medium');
  }

  static notFound(message = 'Not found'): ApiError {
    return new ApiError(404, message, 'not_found', 'low');
  }

  static conflict(message: string): ApiError {
    return new ApiError(409, message, 'conflict', 'medium');
  }

  static tooManyRequests(message = 'Too many requests'): ApiError {
    return new ApiError(429, message, 'rate_limited', 'medium');
  }

  static planLimit(message: string, details?: unknown): ApiError {
    return new ApiError(402, message, 'plan_limit_reached', 'low', details);
  }

  static internal(message = 'Internal server error', details?: unknown): ApiError {
    return new ApiError(500, message, 'internal_error', 'high', details);
  }
}
