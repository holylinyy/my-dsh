import type { info } from 'console'

import type { Context } from './context'
import { buildOuterStack, composeError, DisposableList, isNullable, isObject } from './utils'

declare module './context' {
  export interface Context extends Pick<Fiber, 'effect'> {
    /** The fiber (plugin runtime instance) that owns this context. */
    fiber: Fiber
  }
}

export type Disposable<T = any> = () => T

type SyncEffect<T = any> = Disposable<T> | Iterable<Disposable<T>, void, void>

type AsyncEffect<T = any> = Promise<Disposable<T>> | AsyncIterable<Disposable<T>, void, void>

export type Effect<T = any> = SyncEffect<T> | AsyncEffect<T>

interface EffectRunner<T> {
  epoch: T
  execute: () => any
  collect: (dispose: Disposable) => void
  getOuterStack: () => string[]
}

export const enum FiberState {
  PENDING,
  LOADING,
  ACTIVE,
  FAILED,
  DISPOSED,
  UNLOADING,
}

export class Fiber {
  public _config: any
  public uid: number | null
  public readonly ctx: Context
  protected context: Context
  public state = FiberState.PENDING
  public store: any | undefined
  public readonly _disposables = new DisposableList<Disposable>()

  constructor(
    public parent: Context,
    config: any,
    public inject: any,
    public runtime: any | null,
    getOuterStack: () => string[],
  ) {
    this._config = config
    this.uid = 0
    this.ctx = this.context = parent
    this.state = FiberState.ACTIVE
    this.store = Object.create(null)
  }

  effect(execute: () => SyncEffect, label = 'anonymous'): any {
    const disposables: Disposable[] = []

    const runner: EffectRunner<boolean> = {
      execute,
      epoch: true,
      collect: (dispose) => {
        disposables.push(dispose)
      },
      getOuterStack: buildOuterStack(),
    }

    let executing = true

    try {
      this._execute(runner)
    } catch (reason) {
      executing = false
    }
    executing = false
  }

  private _execute<T>(runner: EffectRunner<T>) {
    const oldEpoch = runner.epoch
    return composeError((info) => {
      const safeCollect = (dispose: void | Disposable) => {
        if (typeof dispose === 'function') {
          runner.collect(dispose)
        } else if (!isNullable(dispose)) {
          throw new TypeError('Invalid effect')
        }
      }

      const effect: Effect = runner.execute.call(this)
      if (typeof effect === 'function') {
        return runner.collect(effect)
      } else if (isNullable(effect)) {
        // return
      } else if (!isObject(effect)) {
        throw new TypeError('Invalid effect')
      } else if ('then' in effect) {
        return effect.then(safeCollect)
      } else if (Symbol.iterator in effect) {
        info.error = new Error()
        const iter = effect[Symbol.iterator]()
        while (true) {
          const result = iter.next()
          safeCollect(result.value)
          if (result.done) return
        }
      } else if (Symbol.asyncIterator in effect) {
        const iter = effect[Symbol.asyncIterator]()
        return (async () => {
          // force async stack trace
          await Promise.resolve()
          info.error = new Error()
          while (true) {
            if (runner.epoch !== oldEpoch) return
            // oxlint-disable-next-line no-await-in-loop
            const result = await iter.next()
            safeCollect(result.value)
            if (result.done) return
          }
        })()
      } else {
        throw new TypeError('Invalid effect')
      }
    })
  }
}
