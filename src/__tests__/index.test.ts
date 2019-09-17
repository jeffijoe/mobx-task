import * as mobxTask from '../index'

const common = require('../index')

test('exports task', () => {
  expect(mobxTask.task).toBeTruthy()
  expect(common.task).toBeTruthy()
})
