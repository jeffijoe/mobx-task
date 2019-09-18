import { promiseTry, proxyGetters } from '../utils'
import { throws } from 'smid'

test('promiseTry catches all errors and rejects promise', async () => {
  const err = await throws(
    promiseTry((): number => {
      throw new Error('hah')
    })
  )

  expect(err.message).toBe('hah')
})

test('promiseTry returns a promise that resolves', async () => {
  const result = await promiseTry(() => {
    return 42
  })

  expect(result).toBe(42)
})

test('proxyGetters defines getters for values on the given object', () => {
  const values = {
    val1: 1,
    val2: 2
  }
  const target: Function & typeof values = (() => 42) as any
  proxyGetters(target, values, ['val1', 'val2'])
  expect(target.val1).toBe(1)
  expect(target.val2).toBe(2)
  expect((target as any).val3).toBe(undefined)

  values.val1 = 1000
  expect(target.val1).toBe(1000)
})
