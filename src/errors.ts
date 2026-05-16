/**
 * CygnisAI SDK – Custom error classes.
 */

export class CygnisAIError extends Error {
  public readonly statusCode: number | undefined;
  public readonly errorDetails: unknown;

  constructor(message: string, statusCode?: number, errorDetails?: unknown) {
    super(message);
    this.name = "CygnisAIError";
    this.statusCode = statusCode ?? undefined;
    this.errorDetails = errorDetails ?? undefined;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class AuthenticationError extends CygnisAIError {
  constructor(message: string, statusCode?: number, errorDetails?: unknown) {
    super(message, statusCode, errorDetails);
    this.name = "AuthenticationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class RateLimitError extends CygnisAIError {
  constructor(message: string, statusCode?: number, errorDetails?: unknown) {
    super(message, statusCode, errorDetails);
    this.name = "RateLimitError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ServerError extends CygnisAIError {
  constructor(message: string, statusCode?: number, errorDetails?: unknown) {
    super(message, statusCode, errorDetails);
    this.name = "ServerError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NetworkError extends CygnisAIError {
  constructor(message: string, errorDetails?: unknown) {
    super(message, undefined, errorDetails);
    this.name = "NetworkError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ResponseValidationError extends CygnisAIError {
  constructor(message: string, errorDetails?: unknown) {
    super(message, undefined, errorDetails);
    this.name = "ResponseValidationError";
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
