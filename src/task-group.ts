import { Task } from './task'
import { observable, reaction, computed } from 'mobx'

type QueryableMethods =
  | 'state'
  | 'pending'
  | 'resolved'
  | 'rejected'
  | 'result'
  | 'error'
  | 'match'

/**
 * The keys that are being proxied.
 */
const keysToDefinePropertiesFor: Array<QueryableMethods> = [
  'state',
  'pending',
  'resolved',
  'rejected',
  'result',
  'error',
  'match',
]

/**
 * Task Group contains queryable properties of the task.
 */
export type TaskGroup<A extends any[], R> = Pick<Task<A, R>, QueryableMethods>

/**
 * Creates a group of tasks where the state of the task that last change its' state
 * is used.
 *
 * @param tasks
 */
export function TaskGroup<A extends any[], R>(
  tasks: Array<Task<A, R>>,
): TaskGroup<A, R> {
  if (!tasks || tasks.length === 0) {
    throw new TypeError(
      'TaskGroup: there must be at least one task in the array passed to TaskGroup.',
    )
  }
  const initialTask = tasks.find((t) => t.pending) || tasks[0]
  const latestTask = observable.box(initialTask, {
    defaultDecorator: observable.ref,
  })
  tasks.forEach((t) => {
    reaction(
      () => t.pending === true,
      (pending) => pending && latestTask.set(t),
    )
  })
  const group: any = {}
  keysToDefinePropertiesFor.forEach((key) => {
    const c = computed(() => latestTask.get()[key])
    Object.defineProperty(group, key, {
      configurable: false,
      get: () => c.get(),
    })
  })
  return group
}
