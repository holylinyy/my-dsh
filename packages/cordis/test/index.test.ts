import { describe, expect, it } from 'vitest'

import { Context, Service } from '../src'

describe('Cordis', () => {
  it('基础使用', () => {
    class Counter extends Service {
      value = 0

      constructor(ctx: Context) {
        super(ctx, 'counter')
      }

      next() {
        return ++this.value
      }
    }
  })
})
