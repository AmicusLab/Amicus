export class SafetyExecutorError extends Error {
  override name = "SafetyExecutorError";
}

export class NotAGitRepositoryError extends SafetyExecutorError {
  override name = "NotAGitRepositoryError";
}

export class DirtyWorkingTreeError extends SafetyExecutorError {
  override name = "DirtyWorkingTreeError";
}

export class RollbackFailedError extends SafetyExecutorError {
  override name = "RollbackFailedError";
}
