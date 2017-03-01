import test from 'ava'
import { reaction, action, observable } from 'mobx'
import task from '../src/task'
import defer from 'promise-defer'
import memoize from 'lodash/memoize'
import { spy } from 'sinon'

test('goes from pending -> resolved', async function (t) {
  const d = defer()
  const base = spy(() => d.promise)
  const fn = task(base)
  t.true(fn.state === 'pending')
  t.true(fn.pending === true)

  const p = fn(1, 2, 3)
  t.true(fn.state === 'pending')
  t.true(fn.pending === true)

  d.resolve(1337)
  const result = await p
  t.is(result, 1337)
  t.is(fn.pending, false)
  t.is(fn.rejected, false)
  t.is(fn.resolved, true)
  t.is(fn.result, 1337)
  t.is(fn.state, 'resolved')
})

test('goes from pending -> rejected on error', async function (t) {
  const d = defer()
  const base = spy(() => d.promise)
  const fn = task(base)
  t.true(fn.state === 'pending')
  t.true(fn.pending === true)

  const p = fn(1, 2, 3)
  t.true(fn.state === 'pending')
  t.true(fn.pending === true)
  const err = new Error('hah')
  d.reject(err)
  const result = await t.throws(p)
  t.is(result, err)
  t.is(fn.pending, false)
  t.is(fn.rejected, true)
  t.is(fn.resolved, false)
  t.is(fn.result, undefined)
  t.is(fn.error, err)
  t.is(fn.state, 'rejected')
})

test('goes from resolved -> pending -> resolved when state is set', async function (t) {
  const d = defer()
  const fn = task(() => d.promise, { state: 'resolved' })

  t.is(fn.resolved, true)
  const p = fn()
  t.is(fn.pending, true)
  d.resolve(1337)
  await p
  t.is(fn.resolved, true)
})

test('state is reactive', (t) => {
  const fn = task(() => 1337)
  const isPending = spy()
  const isResolved = spy()
  const isRejected = spy()
  reaction(() => fn.pending, isPending)
  reaction(() => fn.resolved, isResolved)
  reaction(() => fn.rejected, isRejected)

  fn.setState({ state: 'resolved' })
  fn.setState({ state: 'rejected' })
  fn.setState({ state: 'pending' })

  // these goes from false to true, and from true to false
  t.is(isPending.callCount, 2)
  t.is(isResolved.callCount, 2)
  t.is(isRejected.callCount, 2)
})

test('setState lets me modify the internal state', function (t) {
  const fn = task(() => 1337)
  t.is(fn.pending, true)
  fn.setState({ state: 'resolved', result: 123 })
  t.is(fn.result, 123)
  t.is(fn.resolved, true)
})

test('there are shortcuts to check the state.', function (t) {
  const fn = task(() => 1337)
  t.is(fn.state, 'pending')
  t.is(fn.pending, true)
  t.is(fn.resolved, false)
  t.is(fn.rejected, false)

  fn.setState({ state: 'resolved', result: 123 })
  t.is(fn.state, 'resolved')
  t.is(fn.pending, false)
  t.is(fn.resolved, true)
  t.is(fn.rejected, false)

  fn.setState({ state: 'rejected' })
  t.is(fn.state, 'rejected')
  t.is(fn.pending, false)
  t.is(fn.resolved, false)
  t.is(fn.rejected, true)
})

test('task.resolved shorthand sets state: resolved', (t) => {
  const fn = task.resolved(() => 1337)
  t.is(fn.resolved, true)
})

test('swallow: true does not throw exceptions', async (t) => {
  const err = new Error('haha shiit')
  const fn = task(() => Promise.reject(err), { swallow: true })
  const result = await fn(123)
  t.is(result, undefined)
  t.is(fn.result, undefined)
  t.is(fn.error, err)
})

test('regular decorator', async (t) => {
  const d = defer()
  class Test {
    @task fn (arg) {
      return d.promise.then(() => arg)
    }
  }

  const test = new Test()
  t.is(test.fn.pending, true)

  const p = test.fn(123)
  t.is(test.fn.pending, true)
  d.resolve(1337)
  const result = await p
  t.is(result, 123)
  t.is(test.fn.resolved, true)
  t.is(test.fn.result, 123)
})

test('decorator factory', (t) => {
  class Test {
    @task({ state: 'resolved', result: 1337 }) fn (arg) {
    }
  }

  const test = new Test()
  t.is(test.fn.resolved, true)
  t.is(test.fn.result, 1337)
})

test('preconfigured decorator', (t) => {
  const error = new Error('hah')
  class Test {
    @task.resolved fnResolved () {
    }

    @task.rejected({ error }) fnRejected () {
    }
  }

  const test = new Test()

  t.is(test.fnResolved.resolved, true)
  t.is(test.fnRejected.rejected, true)
  t.is(test.fnRejected.error, error)
})

test('bind returns a task function', async (t) => {
  const fn = task(function (arg1) {
    return [this, arg1]
  })
  const that = {}
  const bound = fn.bind(that, 1)
  const boundResult = await bound(1337)
  t.is(boundResult[0], that)
  t.is(boundResult[1], 1)
})

test('wrap returns a task function', async (t) => {
  const fn = task(() => 42).wrap(spy)
  t.is(await fn(), 42)
  t.is(fn.callCount, 1)
  t.is(fn.resolved, true)
})

test('can be memoized', async (t) => {
  let i = 1
  const fn = task(() => i++).wrap(memoize)
  t.is(await fn(), 1)
  t.is(await fn(), 1)
  t.is(fn.resolved, true)
})

test('can decorate an already decorated method', async (t) => {
  /**
   * For this to work the task decorator has
   * to be the last decorator to run (declared first)
   */
  class Test {
    @task @action.bound method () {
      return this
    }
  }

  const test = new Test()
  t.is(test.method.pending, true)
  const method = test.method
  t.is(await method(), test)
  // twice to test caching
  t.is(await test.method(), test)
})

test('can be tacked onto an observable', async (t) => {
  const store = observable({
    todos: [],
    fetchTodos: task(async () => {
      return [{ text: 'install mobx-task' }]
    })
  })

  t.is(store.fetchTodos.pending, true)
  await store.fetchTodos()
  t.is(store.fetchTodos.resolved, true)
})

test('match returns the case for the current state', (t) => {
  const fn = task(() => undefined)

  const run = () => fn.match({
    pending: () => 1,
    resolved: (value) => value,
    rejected: (err) => err.message
  })

  t.is(run(), 1)

  fn.setState({ state: 'resolved', result: 42 })
  t.is(run(), 42)

  fn.setState({ state: 'rejected', error: new Error('hah') })
  t.is(run(), 'hah')
})

test('match returns undefined if there is no case', (t) => {
  const fn = task(() => undefined)

  const run = () => fn.match({
    resolved: (value) => value,
    rejected: (err) => err.message
  })

  t.is(run(), undefined)

  fn.setState({ state: 'resolved', result: 42 })
  t.is(run(), 42)

  fn.setState({ state: 'rejected', error: new Error('hah') })
  t.is(run(), 'hah')
})

test('calling the function multiple times will only trigger setState:resolved once', async (t) => {
  const fn = task((d) => d.promise)
  const d1 = defer()
  const d2 = defer()

  const p1 = fn(d1)
  const p2 = fn(d2)

  await new Promise((resolve) => setTimeout(resolve, 20))

  d1.resolve(1)
  const r1 = await p1
  t.is(fn.pending, true, 'should still be pending cause we started another task')

  d2.resolve(2)

  const r2 = await p2
  t.is(fn.resolved, true, 'should be resolved after last call is done')

  t.is(r1, 1)
  t.is(r2, 2)
})

test('calling the function multiple times will not trigger setState:rejected if not the last call', async (t) => {
  const fn = task((d) => d.promise)
  const d1 = defer()
  const d2 = defer()

  const p1 = fn(d1)
  const p2 = fn(d2)

  await new Promise((resolve) => setTimeout(resolve, 20))

  d1.reject(new Error('Oh shit'))
  const r1 = await t.throws(p1)
  t.is(fn.pending, true, 'should still be pending cause we started another task')

  d2.resolve(2)

  const r2 = await p2
  t.is(fn.resolved, true, 'should be resolved after last call is done because last call was fine')

  t.is(r1.message, 'Oh shit')
  t.is(r2, 2)
})

test('catches sync errors', async (t) => {
  const fn = task(() => {
    throw new Error('hah')
  })

  await t.throws(fn())
  t.is(fn.rejected, true)
  t.is(fn.error.message, 'hah')
})
