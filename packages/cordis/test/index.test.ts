import { describe, expect, it } from 'vitest'

import { Context } from '../src/context'

describe('Cordis', () => {
  it('基础使用', () => {
    const ctx = new Context('root')
    expect(ctx.name).toBe('root')
  })
})
