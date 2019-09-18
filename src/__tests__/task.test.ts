import { reaction, action, observable } from 'mobx'
import { task } from '../index'
import { memoize } from 'lodash'
import autobind from 'autobind-decorator'
import { throws } from 'smid'
import { defer } from './defer'

// tslint:disable:await-promise no-floating-promises

test('goes from pending -> resolved', async () => {
  const d = defer()
  const base = jest.fn((_a: number, _b: number, _c: number) => d.promise)
  const fn = task(base)
  expect(fn.state === 'pending').toBe(true)
  expect(fn.pending === true).toBe(true)

  const p = fn(1, 2, 3)
  expect(fn.state === 'pending').toBe(true)
  expect(fn.pending === true).toBe(true)

  d.resolve(1337)
  const result = await p
  expect(result).toBe(1337)
  expect(fn.pending).toBe(false)
  expect(fn.rejected).toBe(false)
  expect(fn.resolved).toBe(true)
  expect(fn.result).toBe(1337)
  expect(fn.state).toBe('resolved')
})

test('goes from pending -> rejected on error', async () => {
  const d = defer()
  const base = jest.fn((_a: number, _b: number, _c: number) => d.promise)
  const fn = task(base)
  expect(fn.state === 'pending').toBe(true)
  expect(fn.pending === true).toBe(true)

  const p = fn(1, 2, 3)
  expect(fn.state === 'pending').toBe(true)
  expect(fn.pending === true).toBe(true)
  const err = new Error('hah')
  d.reject(err)
  const result = await throws(p)
  expect(result).toBe(err)
  expect(fn.pending).toBe(false)
  expect(fn.rejected).toBe(true)
  expect(fn.resolved).toBe(false)
  expect(fn.result).toBe(undefined)
  expect(fn.error).toBe(err)
  expect(fn.state).toBe('rejected')
})

test('goes from resolved -> pending -> resolved when state is set', async () => {
  const d = defer()
  const fn = task(() => d.promise, { state: 'resolved' })

  expect(fn.resolved).toBe(true)
  const p = fn()
  expect(fn.pending).toBe(true)
  d.resolve(1337)
  await p
  expect(fn.resolved).toBe(true)
})

test('state is reactive', () => {
  const fn = task(() => 1337)
  const isPending = jest.fn()
  const isResolved = jest.fn()
  const isRejected = jest.fn()
  reaction(() => fn.pending, isPending)
  reaction(() => fn.resolved, isResolved)
  reaction(() => fn.rejected, isRejected)

  fn.setState({ state: 'resolved' })
  fn.setState({ state: 'rejected' })
  fn.setState({ state: 'pending' })

  // these goes from false to true, and from true to false
  expect(isPending).toHaveBeenCalledTimes(2)
  expect(isResolved).toHaveBeenCalledTimes(2)
  expect(isRejected).toHaveBeenCalledTimes(2)
})

test('setState lets me modify the internal state', () => {
  const fn = task(() => 1337)
  expect(fn.pending).toBe(true)
  fn.setState({ state: 'resolved', result: 123 })
  expect(fn.result).toBe(123)
  expect(fn.resolved).toBe(true)
})

test('there are shortcuts to check the state.', () => {
  const fn = task(() => 1337)
  expect(fn.state).toBe('pending')
  expect(fn.pending).toBe(true)
  expect(fn.resolved).toBe(false)
  expect(fn.rejected).toBe(false)

  fn.setState({ state: 'resolved', result: 123 })
  expect(fn.state).toBe('resolved')
  expect(fn.pending).toBe(false)
  expect(fn.resolved).toBe(true)
  expect(fn.rejected).toBe(false)

  fn.setState({ state: 'rejected' })
  expect(fn.state).toBe('rejected')
  expect(fn.pending).toBe(false)
  expect(fn.resolved).toBe(false)
  expect(fn.rejected).toBe(true)
})

test('task.resolved shorthand sets state: resolved', () => {
  const fn = task.resolved(() => 1337)
  expect(fn.resolved).toBe(true)
})

test('swallow: true does not throw exceptions', async () => {
  const err = new Error('haha shiit')
  const fn = task((_a: number) => Promise.reject(err), { swallow: true })
  const result = await fn(123)
  expect(result).toBe(undefined)
  expect(fn.result).toBe(undefined)
  expect(fn.error).toBe(err)
})

test('regular decorator', async () => {
  const d = defer()
  class Test {
    @task
    fn(arg: any) {
      return d.promise.then(() => arg)
    }
  }

  const test = new Test()
  expect((test.fn as any).pending).toBe(true)

  const p = test.fn(123)
  expect((test.fn as any).pending).toBe(true)
  d.resolve(1337)
  const result = await p
  expect(result).toBe(123)
  expect((test.fn as any).resolved).toBe(true)
  expect((test.fn as any).result).toBe(123)
})

test('decorator factory', () => {
  class Test {
    @task({ state: 'resolved', result: 1337 })
    fn(_arg: any) {
      /**/
    }
  }

  const test = new Test()
  expect((test.fn as any).resolved).toBe(true)
  expect((test.fn as any).result).toBe(1337)
})

test('preconfigured decorator', () => {
  const error = new Error('hah')
  class Test {
    @task.resolved
    fnResolved() {
      /**/
    }

    @task.rejected({ error })
    fnRejected() {
      /**/
    }
  }

  const test = new Test()

  expect((test.fnResolved as any).resolved).toBe(true)
  expect((test.fnRejected as any).rejected).toBe(true)
  expect((test.fnRejected as any).error).toBe(error)
})

test('bind returns a task function', async () => {
  const fn = task(function(this: any, arg1: number) {
    return [this, arg1]
  })
  const that = {}
  const bound = fn.bind(that, 1)
  const boundResult = await (bound as any)(1337)
  expect(boundResult[0]).toBe(that)
  expect(boundResult[1]).toBe(1)
})

test('wrap returns a task function', async () => {
  const fn = task(() => 42).wrap(f => {
    const inner = () => {
      inner.callCount += 1
      return f()
    }
    inner.callCount = 0
    return inner
  })
  expect(await fn()).toBe(42)
  expect((fn as any).callCount).toBe(1)
  expect(fn.resolved).toBe(true)
})

test('can be memoized', async () => {
  let i = 1
  const fn = task(() => i++).wrap(memoize)
  expect(await fn()).toBe(1)
  expect(await fn()).toBe(1)
  expect(fn.resolved).toBe(true)
})

test('can decorate an already decorated method', async () => {
  /**
   * For this to work the task decorator has
   * to be the last decorator to run (declared first)
   */
  class Test {
    @task
    @action.bound
    method() {
      return this
    }
  }

  const test = new Test()
  expect((test.method as any).pending).toBe(true)
  const method = test.method
  expect(await method()).toBe(test)
  // twice to test caching
  expect(await method()).toBe(test)
})

test('can be tacked onto an observable', async () => {
  const store = observable({
    todos: [],
    fetchTodos: task(async () => {
      return [{ text: 'install mobx-task' }]
    })
  })

  expect(store.fetchTodos.pending).toBe(true)
  await store.fetchTodos()
  expect(store.fetchTodos.resolved).toBe(true)
})

test('match returns the case for the current state', () => {
  const fn = task((): number | undefined => undefined)

  const run = () =>
    fn.match({
      pending: () => 1,
      resolved: value => value,
      rejected: (err: any) => err.message
    })

  expect(run()).toBe(1)

  fn.setState({ state: 'resolved', result: 42 })
  expect(run()).toBe(42)

  fn.setState({ state: 'rejected', error: new Error('hah') })
  expect(run()).toBe('hah')
})

test('match returns undefined if there is no case', () => {
  const fn = task((): number | undefined => undefined)

  const run = () =>
    fn.match({
      resolved: value => value,
      rejected: (err: any) => err.message
    })

  expect(run()).toBe(undefined)

  fn.setState({ state: 'resolved', result: 42 })
  expect(run()).toBe(42)

  fn.setState({ state: 'rejected', error: new Error('hah') })
  expect(run()).toBe('hah')
})

test('match passes arguments to pending', () => {
  const fn = task((_a: number, _b: number) => undefined)
  let calledWith = null
  fn(1, 2)
  fn.match({
    pending: (arg1, arg2) => {
      calledWith = [arg1, arg2]
    }
  })
  expect(calledWith).toEqual([1, 2])
})

test('calling the function multiple times will only trigger setState:resolved once', async () => {
  const fn = task(d => d.promise)
  const d1 = defer()
  const d2 = defer()

  const p1 = fn(d1)
  const p2 = fn(d2)

  await new Promise(resolve => setTimeout(resolve, 20))

  d1.resolve(1)
  const r1 = await p1
  expect(fn.pending).toBe(true)

  d2.resolve(2)

  const r2 = await p2
  expect(fn.resolved).toBe(true)

  expect(r1).toBe(1)
  expect(r2).toBe(2)
})

test('calling the function multiple times will not trigger setState:rejected if not the last call', async () => {
  const fn = task(d => d.promise)
  const d1 = defer()
  const d2 = defer()

  const p1 = fn(d1)
  const p2 = fn(d2)

  await new Promise(resolve => setTimeout(resolve, 20))

  d1.reject(new Error('Oh shit'))
  const r1 = await throws(() => p1)
  expect(fn.pending).toBe(true)

  d2.resolve(2)

  const r2 = await p2
  expect(fn.resolved).toBe(true)

  expect(r1.message).toBe('Oh shit')
  expect(r2).toBe(2)
})

test('catches sync errors', async () => {
  const fn = task(() => {
    throw new Error('hah')
  })

  await throws(() => fn())
  expect(fn.rejected).toBe(true)
  expect((fn.error as any).message).toBe('hah')
})

test('reset() resets the state to resolved with result', async () => {
  const fn = task(
    () => {
      return 1337
    },
    { state: 'resolved', result: 42 }
  )
  expect(fn.result).toBe(42)

  const result = await fn()
  expect(result).toBe(1337)
  expect(fn.state).toBe('resolved')

  const fromReset = fn.reset()
  expect(fromReset).toBe(fn)
  expect(fn.result).toBe(42)
})

test('reset() resets the state to pending', async () => {
  const fn = task(() => {
    return 1337
  })
  expect(fn.result).toBe(undefined)

  const result = await fn()
  expect(result).toBe(1337)
  expect(fn.state).toBe('resolved')

  fn.reset()
  expect(fn.result).toBe(undefined)
  expect(fn.state).toBe('pending')
})

test('autobind works', async () => {
  @autobind
  class Test {
    value: number

    constructor() {
      this.value = 42
    }

    @task
    @autobind
    func() {
      return this.value
    }
  }

  const sub = new Test()
  const fn = sub.func
  const result = await fn()
  expect(result).toBe(42)
  expect((fn as any).state).toBe('resolved')
  expect((sub.func as any).state).toBe('resolved')
})

test('can reassign decorated method', async () => {
  class Test {
    @task
    method() {
      /**/
    }
  }

  const sub = new Test()
  sub.method = 123 as any
  expect(sub.method).toBe(123)
})

test('decorator value is cached', async () => {
  class Test {
    @task
    method() {
      return 42
    }
  }

  const sub = new Test()
  expect(await sub.method()).toBe(42)
  expect(await sub.method()).toBe(42)
})

test('decorator supports fields with functions', async () => {
  class Test {
    @task method = function() {
      return 42
    }
  }

  const sub = new Test()
  expect(await sub.method()).toBe(42)
})

test('decorator supports fields with arrow functions', async () => {
  class Test {
    getValue() {
      return 42
    }

    @task method = () => this.getValue()
  }

  const sub = new Test()
  expect(await sub.method()).toBe(42)
})
