export const symbols = {}

export class DisposableList<T extends WeakKey> {
  private sn = 0
  private map = new Map<number, T>()
  private weak = new WeakMap<T, number>()

  get length() {
    return this.map.size
  }

  push(value: T) {
    const sn = ++this.sn
    this.map.set(sn, value)
    this.weak.set(value, sn)
    return () => this.map.delete(sn)
  }

  delete(value: T) {
    const sn = this.weak.get(value)
    if (!sn) return false
    return this.map.delete(sn)
  }

  clear() {
    const values = [...this.map.values()]
    this.map.clear()
    return values.toReversed()
  }

  [Symbol.iterator]() {
    return this.map.values()
  }

  [Symbol.for('nodejs.util.inspect.custom')]() {
    return [...this]
  }
}

export function buildOuterStack(offset = 0) {
  const outerError = new Error()
  return () => outerError.stack!.split('\n').slice(3 + offset)
}

interface StackInfo {
  offset: number
  error: Error
}

export function isObject(value: any): value is {} {
  return value && (typeof value === 'object' || typeof value === 'function')
}

function handleError(info: StackInfo, reason: any, getOuterStack: () => string[]): never {
  const innerLines = info.error.stack!.split('\n')

  // malformed error
  if (typeof reason?.stack !== 'string') {
    const outerError = new Error(reason)
    const lines = outerError.stack!.split('\n')
    lines.splice(1, Infinity, ...getOuterStack())
    outerError.stack = lines.join('\n')
    throw outerError
  }

  // long stack trace
  const lines: string[] = reason.stack.split('\n')
  let index = lines.indexOf(innerLines[2]!)
  if (index === -1) throw reason

  index -= info.offset
  while (index > 0) {
    if (!lines[index - 1]!.endsWith(' (<anonymous>)')) break
    index -= 1
  }
  lines.splice(index, Infinity, ...getOuterStack())
  reason.stack = lines.join('\n')
  throw reason
}

export function isNullable(value: any): value is null | undefined | void {
  return value === null || value === undefined
}

export function composeError<T>(
  callback: (info: StackInfo) => T,
  getOuterStack = buildOuterStack(),
): T {
  const info: StackInfo = { offset: 1, error: new Error() }

  try {
    const result: any = callback(info)
    if (isObject(result) && 'then' in result) {
      return (result as any).then(undefined, (reason) =>
        handleError(info, reason, getOuterStack),
      ) as T
    } else {
      return result
    }
  } catch (reason: any) {
    handleError(info, reason, getOuterStack)
  }
}
