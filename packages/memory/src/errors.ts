export class MemoryManagerError extends Error {
  override name = "MemoryManagerError";
}

export class FileReadError extends MemoryManagerError {
  override name = "FileReadError";
}

export class FileWriteError extends MemoryManagerError {
  override name = "FileWriteError";
}

export class InvalidMarkdownError extends MemoryManagerError {
  override name = "InvalidMarkdownError";
}
