import * as mobxTask from '../index'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const common = require('../index')

test('exports task', () => {
  expect(mobxTask.task).toBeTruthy()
  expect(common.task).toBeTruthy()
})
