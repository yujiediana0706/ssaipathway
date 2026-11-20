/** 简历工作台的统一错误类型：code 给前端判断，message 直接展示给用户 */
export class StudioError extends Error {
  readonly code: string;
  readonly retryable: boolean;

  constructor(code: string, message: string, retryable = false) {
    super(message);
    this.name = "StudioError";
    this.code = code;
    this.retryable = retryable;
  }
}

export function toStudioError(err: unknown): StudioError {
  if (err instanceof StudioError) return err;
  const message = err instanceof Error ? err.message : String(err);
  return new StudioError("INTERNAL", message || "Unexpected error", true);
}
