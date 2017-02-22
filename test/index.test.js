import test from 'ava'
import * as mobxTask from '../src/index'

const common = require('../src/index')

test('exports task', (t) => {
  t.truthy(mobxTask.task)
  t.truthy(common.task)
})
