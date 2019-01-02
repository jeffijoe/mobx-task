import task from '../task'

test('#3: should not share state between instances', async () => {
  class Subject {
    constructor(result) {
      this.result = result
    }

    @task
    func() {
      return this.result
    }
  }

  const a = new Subject(1)
  const b = new Subject(2)

  const aResult = await a.func()
  expect(aResult).toBe(1)
  expect(a.func.result).toBe(1)
  expect(b.func.result).not.toBe(1)

  const bResult = await b.func()
  expect(bResult).toBe(2)
  expect(a.func.result).toBe(1)
  expect(b.func.result).toBe(2)
})

test('#3: can still reassign the func', async () => {
  class Subject {
    constructor(result) {
      this.result = result
      this.func = this.func.wrap(fn => () => {
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

  expect(a.intercepted).toBe(undefined)
  const aResult = await a.func()
  expect(a.intercepted).toBe(true)
  expect(aResult).toBe(1)
  expect(a.func.result).toBe(1)
  expect(b.func.result).not.toBe(1)

  expect(b.intercepted).toBe(undefined)
  const bResult = await b.func()
  expect(b.intercepted).toBe(true)
  expect(bResult).toBe(2)
  expect(a.func.result).toBe(1)
  expect(b.func.result).toBe(2)
})
