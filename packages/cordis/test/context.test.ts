import { describe, expect, it } from 'vitest'

import { Context } from '../src/context'

describe('Context', () => {
  it('保存传入的 name', () => {
    const ctx = new Context('root')
    expect(ctx.name).toBe('root')
  })

  it('不同实例的 name 相互独立', () => {
    expect(new Context('a').name).toBe('a')
    expect(new Context('b').name).toBe('b')
  })
})
