import test from 'ava'
import { promiseTry, proxyGetters } from '../src/utils'

test('promiseTry catches all errors and rejects promise', async (t) => {
  const err = await t.throws(promiseTry(() => {
    throw new Error('hah')
  }))

  t.is(err.message, 'hah')
})

test('promiseTry returns a promise that resolves', async (t) => {
  const result = await promiseTry(() => {
    return 42
  })

  t.is(result, 42)
})

test('proxyGetters defines getters for values on the given object', (t) => {
  const target = () => 42
  const values = {
    val1: 1,
    val2: 2
  }
  proxyGetters(target, values, ['val1', 'val2'])
  t.is(target.val1, 1)
  t.is(target.val2, 2)
  t.is(target.val3, undefined)

  values.val1 = 1000
  t.is(target.val1, 1000)
})
