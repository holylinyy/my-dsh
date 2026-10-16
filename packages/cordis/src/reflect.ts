import type { Context } from './context'

export class ReflectService {
  static handle: ProxyHandler<Context> = {
    get(target, prop, receiver) {
      if (prop === 'ctx') {
        return target
      }
      return Reflect.get(target, prop, receiver)
    },
    set(target, prop, value, receiver) {
      if (prop === 'ctx') {
        throw new Error('Cannot set ctx property')
      }
      return Reflect.set(target, prop, value, receiver)
    },
    has(target, prop) {
      if (prop === 'ctx') {
        return true
      }
      return Reflect.has(target, prop)
    },
  }

  constructor(public ctx: Context) {}

  mixin(source: any, mixin: string[]) {
    const self = this
    return this.ctx.fiber.effect(function* () {})
  }
}
