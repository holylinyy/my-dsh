import { Context } from './context'
import {} from './utils'
export abstract class Service {
  constructor(public ctx: Context) {
    // oxlint-disable-next-line typescript/no-this-alias
    let self = this
    self.ctx = ctx
    return self
  }
}
