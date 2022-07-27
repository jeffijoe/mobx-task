import { task } from '../task'

// tslint:disable:await-promise

test('#3: should not share state between instances', async () => {
  class Subject {
    constructor(public result: number) {}

    @task
    func() {
      return this.result
    }
  }

  const a = new Subject(1)
  const b = new Subject(2)

  const aResult = await a.func()
  expect(aResult).toBe(1)
  expect((a.func as any).result).toBe(1)
  expect((b.func as any).result).not.toBe(1)

  const bResult = await b.func()
  expect(bResult).toBe(2)
  expect((a.func as any).result).toBe(1)
  expect((b.func as any).result).toBe(2)
})

test('#3: can still reassign the func', async () => {
  class Subject {
    intercepted: boolean = false
    result: number = 0
    constructor(result: number) {
      this.result = result
      this.func = (this.func as any).wrap((fn: any) => () => {
        this.intercepted = true
        return fn.call(this)
      })
    }

    @task
    func() {
      return this.result
    }
  }

  const a = new Subject(1)
  const b = new Subject(2)

  expect(a.intercepted).toBe(false)
  const aResult = await a.func()
  expect(a.intercepted).toBe(true)
  expect(aResult).toBe(1)
  expect((a.func as any).result).toBe(1)
  expect((b.func as any).result).not.toBe(1)

  expect(b.intercepted).toBe(false)
  const bResult = await b.func()
  expect(b.intercepted).toBe(true)
  expect(bResult).toBe(2)
  expect((a.func as any).result).toBe(1)
  expect((b.func as any).result).toBe(2)
})
