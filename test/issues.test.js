import test from 'ava'
import task from '../src/task'

test('#3: should not share state between instances', async (t) => {
  class Subject {
    constructor (result) {
      this.result = result
    }

    @task func () {
      return this.result
    }
  }

  const a = new Subject(1)
  const b = new Subject(2)

  const aResult = await a.func()
  t.is(aResult, 1)
  t.is(a.func.result, 1)
  t.not(b.func.result, 1)

  const bResult = await b.func()
  t.is(bResult, 2)
  t.is(a.func.result, 1)
  t.is(b.func.result, 2)
})
