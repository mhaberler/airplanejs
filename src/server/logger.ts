export interface Logger {
  debug: (...args: unknown[]) => void
  info: (...args: unknown[]) => void
  warn: (...args: unknown[]) => void
  error: (...args: unknown[]) => void
}

/** Tiny namespaced logger (replaces the `debug` package). */
export function createLogger (namespace: string): Logger {
  const prefix = `[${namespace}]`
  return {
    debug: (...args: unknown[]) => {
      if (process.env.DEBUG) console.debug(prefix, ...args)
    },
    info: (...args: unknown[]) => console.log(prefix, ...args),
    warn: (...args: unknown[]) => console.warn(prefix, ...args),
    error: (...args: unknown[]) => console.error(prefix, ...args)
  }
}
