import { Fiber } from './fiber'
import { ReflectService } from './reflect'

export interface Context {
  root: this
  reflect: ReflectService
}

export class Context {
  constructor() {
    const self = new Proxy<this>(this, ReflectService.handle)
    this.root = self
    this.fiber = new Fiber(self, {}, Object.create(null), null, () => [])
    this.reflect = new ReflectService(self)
    return self
  }
}
