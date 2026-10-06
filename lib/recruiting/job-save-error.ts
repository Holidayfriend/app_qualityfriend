export function jobSaveErrorKey(status: number, code: unknown, reason?: unknown) {
  if (code === "TRANSLATION_FAILED") {
    if (reason === "AI_NOT_CONFIGURED") return "jobAiNotConfigured";
    if (reason === "TIMEOUT") return "jobTranslationTimeout";
    return "jobTranslationFailed";
  }
  if (status === 401 || status === 403) return "jobAccessDenied";
  if (status === 404) return "jobNotFound";
  if (status >= 500) return "jobServerFailed";
  if (code === "INVALID_DEPARTMENT") return "jobDepartmentInvalid";
  if (status === 400) return "jobInvalidData";
  return "saveFailed";
}

export function jobTranslationFailureReason(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "HotelAiNotConfiguredError") return "AI_NOT_CONFIGURED";
    if (error.name === "TimeoutError" || error.name === "AbortError") return "TIMEOUT";
    if (error instanceof SyntaxError || /^(Incomplete job translation|Empty job translation|Translated title too long|Translated benefits too long)$/.test(error.message)) return "INVALID_AI_RESPONSE";
  }
  return "AI_REQUEST_FAILED";
}
