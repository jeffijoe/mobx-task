const { observable, action } = require('mobx')
const { proxyGetters, promiseTry } = require('./utils')

/**
 * Wraps the given function in a task function.
 *
 * @param  {Function} fn
 * @return {Task}
 */
function createTask(fn, opts) {
  opts = {
    swallow: false,
    state: 'pending',
    ...opts
  }

  // Track how many times this task was called.
  // Used to prevent premature state changes when the
  // task is called again before the first run completes.
  let callCount = 0

  /**
   * The actual task function.
   */
  function task() {
    const callCountWhenStarted = ++callCount
    return promiseTry(() => {
      task.setState({ state: 'pending', error: undefined, result: undefined })
      return Promise.resolve(fn.apply(this, arguments)).then(result => {
        // If we called the task again before the first
        // one completes, we don't want to set to resolved before the last call completes.
        if (callCountWhenStarted === callCount) {
          task.setState({ state: 'resolved', error: undefined, result })
        }
        return result
      })
    }).catch(err => {
      if (callCountWhenStarted === callCount) {
        task.setState({ state: 'rejected', error: err, result: undefined })
      }
      if (!opts.swallow) {
        throw err
      }
    })
  }

  const taskStateSchema = {
    state: opts.state,
    error: opts.error,
    result: opts.result,
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
  const taskState = observable.object(taskStateSchema, {
    error: observable.ref
  })

  setupTask(task, taskState, taskStateSchemaKeys, opts)
  return task
}

/**
 * Assigns the task methods and state to the given function.
 */
function setupTask(fn, taskState, taskStateSchemaKeys, opts) {
  const setup = func => setupTask(func, taskState, taskStateSchemaKeys, opts)
  proxyGetters(fn, taskState, taskStateSchemaKeys)
  Object.assign(fn, {
    /**
     * Patch `bind` so we always return
     * the task function (with the additional properties)
     */
    bind: (...args) => {
      const bound = Function.prototype.bind.apply(fn, args)
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
    wrap: wrapper => {
      return setup(
        wrapper(function wrapped() {
          return fn.apply(this, arguments)
        })
      )
    },
    /**
     * Assigns the given properties to the task.
     * E.g. task.setState({ state: 'resolved', result: 1337 })
     */
    setState: action(opts => {
      Object.assign(taskState, opts)
      return fn
    }),
    /**
     * Given an object, returns the value for the key which equals the
     * current state, or undefined if not specified.
     */
    match: obj => {
      const state = taskState.state
      const match = obj[state]

      if (!match) {
        return undefined
      }

      if (state === 'resolved') {
        return match(taskState.result)
      }

      if (state === 'rejected') {
        return match(taskState.error)
      }

      return match()
    },
    /**
     * Resets the state to what it was when initialized.
     */
    reset: () => {
      fn.setState({
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
function taskCreatorFactory(opts) {
  /**
   * Decorator to make async functions "so fucking graceful", by maintaining observables for errors
   * and running state.
   */
  return function task(arg1, arg2, arg3) {
    if (typeof arg1 === 'function') {
      // regular invocation
      return createTask(arg1, { ...opts, ...arg2 })
    }

    const makeDecorator = innerOpts => {
      return function decorator(target, name, descriptor) {
        let get = descriptor.get
        if (descriptor.value) {
          const fn = descriptor.value
          delete descriptor.writable
          delete descriptor.value
          get = () => fn
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
          set: function setter(newValue) {
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

const task = taskCreatorFactory()
task.resolved = taskCreatorFactory({ state: 'resolved' })
task.rejected = taskCreatorFactory({ state: 'rejected' })

module.exports = task
