import { describe, expect, it } from 'vitest'

import { ReflectService } from '../src/reflect'

describe('ReflectService', () => {
  it('可以被实例化', () => {
    const service = new ReflectService()
    expect(service).toBeInstanceOf(ReflectService)
  })
})
