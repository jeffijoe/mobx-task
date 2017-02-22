import test from 'ava'
import * as mobxTask from '../src/index'

test('exports task', (t) => {
  t.truthy(mobxTask.task)
})
