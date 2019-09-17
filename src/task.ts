import { observable, action } from 'mobx'
import { proxyGetters, promiseTry } from './utils'

/**
 * Task status.
 */
export type TaskStatus = 'pending' | 'resolved' | 'rejected'

/**
 * Task function signature.
 */
export type TaskFunc<A extends any[], R> = (...args: A) => Promise<R>

/**
 * Task options.
 */
export interface TaskOptions<A extends any[], R> {
  state?: TaskStatus
  error?: unknown
  result?: R
  args?: A
  swallow?: boolean
}

/**
 * Object type used for pattern matching.
 */
export interface TaskMatchProps<T1, T2, T3, A extends any[], R = any> {
  pending?: (...args: A) => T1
  rejected?: (error: unknown) => T2
  resolved?: (result: R) => T3
}

/**
 * Task state.
 */
export interface TaskState<A extends any[], R> {
  /**
   * The status (resolved, rejected, pending)
   */
  readonly state: TaskStatus
  /**
   * Convenience getter for `state === 'pending'`.
   */
  readonly pending: boolean
  /**
   * Convenience getter for `state === 'resolved'`.
   */
  readonly resolved: boolean
  /**
   * Convenience getter for `state === 'rejected'`.
   */
  readonly rejected: boolean
  /**
   * The last arguments passed to the task.
   */
  readonly args: A
  /**
   * The result of the last invocation.
   */
  readonly result?: R
  /**
   * The error of the last failed invocation.
   */
  readonly error?: unknown
}

/**
 * Task methods.
 */
export interface TaskMethods<A extends any[], R> {
  /**
   * Pattern-matches on the task status.
   * @param props
   */
  match<PT, ET, RT>(props: TaskMatchProps<PT, ET, RT, A, R>): PT | ET | RT
  /**
   * Wraps the task by invoking `func` with the inner task function, which returns the wrapped function
   * and converts that to a task.
   *
   * @param func
   */
  wrap<NA extends any[], NR>(
    func: (inner: (...args: A) => R) => (...args: NA) => NR
  ): Task<NA, NR>
  /**
   * Sets the state.
   */
  setState(props: TaskOptions<A, R>): void
  /**
   * Resets the state.
   */
  reset(): void
}

/**
 * Task function, state and methods.
 */
export type Task<A extends any[], R> = TaskFunc<A, R> &
  TaskState<A, R> &
  TaskMethods<A, R>

/**
 * Actual task factory.
 */
export interface TaskCreator<K extends keyof TaskOptions<any, any>>
  extends MethodDecorator,
    PropertyDecorator {
  /**
   * Calls the actual task function.
   */
  <A extends any[], R>(
    func: (...args: A) => R,
    options?: Pick<TaskOptions<A, R>, K>
  ): Task<A, R>

  (options: Pick<TaskOptions<any, any>, K>): PropertyDecorator
  (options: Pick<TaskOptions<any, any>, K>): MethodDecorator
}

export interface TaskFactory extends TaskCreator<keyof TaskOptions<any, any>> {
  /**
   * Creates a task in the `resolved` state.
   */
  resolved: TaskCreator<Exclude<keyof TaskOptions<any, any>, 'state'>>
  /**
   * Creates a task in the `rejected` state.
   */
  rejected: TaskCreator<Exclude<keyof TaskOptions<any, any>, 'state'>>
}

/**
 * Creates a task in the `pending` state.
 */
const task: TaskFactory = taskCreatorFactory() as any
task.resolved = taskCreatorFactory({ state: 'resolved' }) as any
task.rejected = taskCreatorFactory({ state: 'rejected' }) as any

export { task }

/**
 * Wraps the given function in a task function.
 *
 * @param  {Function} fn
 * @return {Task}
 */
function createTask<A extends any[], R>(
  fn: (...args: A) => R | Promise<R>,
  opts: TaskOptions<A, R>
) {
  opts = {
    swallow: false,
    state: 'pending',
    args: ([] as unknown) as A,
    ...opts
  }

  // Track how many times this task was called.
  // Used to prevent premature state changes when the
  // task is called again before the first run completes.
  let callCount = 0

  /**
   * The actual task function.
   */
  function task(this: any, ...args: A) {
    const callCountWhenStarted = ++callCount
    return promiseTry(() => {
      ;(task as Task<A, R>).setState({
        state: 'pending',
        error: undefined,
        result: undefined,
        args: Array.from(arguments) as A
      })
      return Promise.resolve(fn.apply(this, args)).then(result => {
        // If we called the task again before the first
        // one completes, we don't want to set to resolved before the last call completes.
        if (callCountWhenStarted === callCount) {
          ;(task as Task<A, R>).setState({
            state: 'resolved',
            error: undefined,
            result
          })
        }
        return result
      })
    }).catch(err => {
      if (callCountWhenStarted === callCount) {
        ;(task as Task<A, R>).setState({
          state: 'rejected',
          error: err,
          result: undefined
        })
      }
      if (!opts.swallow) {
        throw err
      }
      // To avoid the case where `opts.swallow` is true.
      // If you use this, you know the risks.
      return (undefined as unknown) as R
    })
  }

  const taskStateSchema: TaskState<A, R> = {
    state: opts.state!,
    error: opts.error,
    result: opts.result,
    args: opts.args!,
    get pending() {
      return taskState.state === 'pending'
    },
    get resolved() {
      return taskState.state === 'resolved'
    },
    get rejected() {
      return taskState.state === 'rejected'
    }
  }

  const taskStateSchemaKeys = Object.keys(taskStateSchema)
  const taskState = observable.object(
    taskStateSchema,
    {
      error: observable.ref,
      result: observable.ref,
      args: observable.ref
    },
    {
      deep: false
    }
  )

  setupTask(task, taskState, taskStateSchemaKeys, opts)
  return task
}

/**
 * Assigns the task methods and state to the given function.
 */
function setupTask<A extends any[], R>(
  fn: (...args: A) => Promise<R>,
  taskState: TaskState<A, R>,
  taskStateSchemaKeys: any,
  opts: TaskOptions<A, R>
) {
  const setup = (func: any) =>
    setupTask(func, taskState, taskStateSchemaKeys, opts)
  proxyGetters(fn, taskState, taskStateSchemaKeys)
  Object.assign(fn, {
    /**
     * Patch `bind` so we always return
     * the task function (with the additional properties)
     */
    bind: (...args: any[]) => {
      const bound = Function.prototype.bind.apply(fn, args as any)
      return setup(bound)
    },
    /**
     * Wraps the task and returns the new function with the task stuff attached.
     *
     * @param {Function} wrapper
     * Invoked with the inner function as the only parameter.
     *
     * @return {Task}
     * Wrapped function as a task.
     */
    wrap: (wrapper: any) => {
      return setup(
        wrapper(function wrapped(this: any, ...args: A) {
          return fn.apply(this, args)
        })
      )
    },
    /**
     * Assigns the given properties to the task.
     * E.g. task.setState({ state: 'resolved', result: 1337 })
     */
    setState: action('setState', (opts: TaskOptions<A, R>) => {
      Object.assign(taskState, opts)
      return fn
    }),
    /**
     * Given an object, returns the value for the key which equals the
     * current state, or undefined if not specified.
     */
    match: (obj: any) => {
      const state = taskState.state
      const match = obj[state]

      if (!match) {
        return undefined
      }

      switch (state) {
        case 'pending':
          return match.apply(null, taskState.args)
        case 'resolved':
          return match(taskState.result)
        case 'rejected':
          return match(taskState.error)
      }
      /* istanbul ignore next */
      return match()
    },
    /**
     * Resets the state to what it was when initialized.
     */
    reset: () => {
      ;(fn as Task<A, R>).setState({
        state: opts.state,
        result: opts.result,
        error: opts.error
      })
      return fn
    }
  })
  return fn
}

/**
 * Returns a function, which returns either a decorator, a task, or a decorator factory.
 */
function taskCreatorFactory<A extends any[], R>(opts?: TaskOptions<A, R>) {
  /**
   * Decorator to make async functions "so fucking graceful", by maintaining observables for errors
   * and running state.
   */
  return function task(arg1: any, arg2: any, arg3: any) {
    if (typeof arg1 === 'function') {
      // regular invocation
      return createTask(arg1, { ...opts, ...arg2 })
    }

    const makeDecorator = (innerOpts?: any) => {
      return function decorator(
        _target: any,
        name: string,
        descriptor: any = {}
      ) {
        let get = descriptor.get
        if (descriptor.value || descriptor.initializer) {
          const fn = descriptor.value
          delete descriptor.writable
          delete descriptor.value
          get = fn
            ? () => fn
            : /* istanbul ignore next: babel */ descriptor.initializer
        }

        // In IE11 calling Object.defineProperty has a side-effect of evaluating the
        // getter for the property which is being replaced. This causes infinite
        // recursion and an "Out of stack space" error.
        // Credit: autobind-decorator source
        let definingProperty = false
        return {
          get: function getter() {
            /* istanbul ignore next */
            if (definingProperty) {
              return get.apply(this)
            }

            const fn = get.apply(this, arguments)
            const wrapped = createTask(fn, { ...opts, ...innerOpts })
            definingProperty = true
            Object.defineProperty(this, name, {
              value: wrapped,
              configurable: true,
              writable: true
            })
            definingProperty = false
            return wrapped
          },
          set: function setter(newValue: any) {
            Object.defineProperty(this, name, {
              configurable: true,
              writable: true,
              // IS enumerable when reassigned by the outside word
              enumerable: true,
              value: newValue
            })

            return newValue
          }
        }
      }
    }

    // decorator invocation
    if (typeof arg2 === 'string') {
      // parameterless - @task method()
      return makeDecorator()(arg1, arg2, arg3)
    }

    // parameters - @task({ state: 'resolved' }) method()
    return makeDecorator({ ...opts, ...arg1 })
  }
}
