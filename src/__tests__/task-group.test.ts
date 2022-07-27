import { TaskGroup } from '../task-group'
import { task } from '../task'
import { defer } from './defer'
import { throws } from 'smid'
import { reaction } from 'mobx'

// tslint:disable:await-promise no-floating-promises

test('task group', async () => {
  const deferred1 = defer<number>()
  const deferred2 = defer<number>()
  const deferred3 = defer<number>()
  const task1 = task.resolved(() => deferred1.promise)
  const task2 = task.resolved(() => deferred2.promise)
  const task3 = task.resolved(() => deferred3.promise)
  const group = TaskGroup([task1, task2, task3])

  const reactor = jest.fn()
  reaction(
    () =>
      group.match({
        pending: () => 'pending',
        resolved: () => 'resolved',
        rejected: () => 'rejected',
      }),
    (v) => reactor(v)
  )

  expect(group.state).toBe('resolved')
  expect(group.resolved).toBe(true)
  expect(group.match({ resolved: () => true })).toBe(true)

  const p1 = task1()
  expect(group.state).toBe('pending')
  expect(expect(group.match({ pending: () => true })).toBe(true))

  deferred1.resolve(123)
  expect(await p1).toBe(123)
  expect(group.state).toBe('resolved')
  expect(expect(group.match({ resolved: () => true })).toBe(true))

  const p3 = task3()
  expect(group.state).toBe('pending')

  deferred3.reject(new Error('nah'))
  expect(await throws(p3)).toMatchObject({ message: 'nah' })

  expect(reactor).toHaveBeenCalledTimes(4)
  expect(reactor).toHaveBeenCalledWith('pending')
  expect(reactor).toHaveBeenCalledWith('resolved')
  expect(reactor).toHaveBeenCalledWith('rejected')
})

test('sets the initial task to the first pending found in the input', async () => {
  const deferred1 = defer<number>()
  const deferred2 = defer<number>()
  const deferred3 = defer<number>()
  const task1 = task.resolved(() => deferred1.promise)
  const task2 = task(() => deferred2.promise)
  const task3 = task.resolved(() => deferred3.promise)
  const group = TaskGroup([task1, task2, task3])

  expect(group.pending).toBe(true)

  deferred2.resolve(2)
  await task2()
  expect(group.resolved).toBe(true)
})

test('only switches task on pending change', async () => {
  const deferred1 = defer<number>()
  const deferred2 = defer<number>()
  const deferred3 = defer<number>()
  const task1 = task.resolved(() => deferred1.promise)
  const task2 = task.resolved(() => deferred2.promise)
  const task3 = task.resolved(() => deferred3.promise)
  const group = TaskGroup([task1, task2, task3])

  const p1 = task1()
  const p2 = task2()
  deferred1.resolve(1)

  await p1
  expect(group.pending).toBe(true)

  deferred2.resolve(2)
  await p2
  expect(group.resolved).toBe(true)
  expect(group.match({ resolved: (v) => v * 10 })).toBe(20)
})

test('invalid tasks length', () => {
  expect(() => TaskGroup([])).toThrowErrorMatchingInlineSnapshot(
    `"TaskGroup: there must be at least one task in the array passed to TaskGroup."`
  )
})
