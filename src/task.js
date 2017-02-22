const { observable, computed, action } = require('mobx')
const { proxyGetters, promiseTry } = require('./utils')

/**
 * Wraps the given function in a task function.
 *
 * @param  {Function} fn
 * @return {Task}
 */
function createTask (fn, opts) {
  opts = {
    swallow: false,
    state: 'pending',
    ...opts
  }

  /**
   * The actual task function.
   */
  function task () {
    return promiseTry(() => {
      task.setState({ state: 'pending', error: undefined, result: undefined })
      return Promise.resolve(fn.apply(this, arguments)).then((result) => {
        task.setState({ state: 'resolved', error: undefined, result })
        return result
      }).catch(err => {
        task.setState({ state: 'rejected', error: err, result: undefined })
        if (!opts.swallow) {
          throw err
        }
      })
    })
  }

  const stateGetter = (state) => computed(() => taskState.state === state)
  const taskStateSchema = {
    state: opts.state,
    error: observable.ref(opts.error),
    result: opts.result,
    pending: stateGetter('pending'),
    resolved: stateGetter('resolved'),
    rejected: stateGetter('rejected')
  }

  const taskStateSchemaKeys = Object.keys(taskStateSchema)
  const taskState = observable(taskStateSchema)

  setupTask(task, taskState, taskStateSchemaKeys)
  return task
}

/**
 * Assigns the task methods and state to the given function.
 */
function setupTask (fn, taskState, taskStateSchemaKeys) {
  const setup = (func) => setupTask(func, taskState, taskStateSchemaKeys)
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
    wrap: (wrapper) => {
      return setup(wrapper(function wrapped () {
        return fn.apply(this, arguments)
      }))
    },
    /**
     * Assigns the given properties to the task.
     * E.g. task.setState({ state: 'resolved', result: 1337 })
     */
    setState: action((opts) => {
      Object.assign(taskState, opts)
      return fn
    }),
    /**
     * Given an object, returns the value for the key which equals the
     * current state, or undefined if not specified.
     */
    match: (obj) => {
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
    }
  })
  return fn
}

/**
 * Returns a function, which returns either a decorator, a task, or a decorator factory.
 */
function taskCreatorFactory (opts) {
  /**
   * Decorator to make async functions "so fucking graceful", by maintaining observables for errors
   * and running state.
   */
  return function task (arg1, arg2, arg3) {
    if (typeof arg1 === 'function') {
      // regular invocation
      return createTask(arg1, { ...opts, ...arg2 })
    }

    const makeDecorator = (inner) => {
      return function decorator (target, name, descriptor) {
        if (descriptor.value) {
          const fn = descriptor.value
          delete descriptor.writable
          delete descriptor.value
          descriptor.value = createTask(fn, { ...opts, ...inner })
        } else {
          const get = descriptor.get
          let t
          descriptor.get = function getter () {
            /* istanbul ignore next */
            if (t) {
              return t
            }

            const fn = get.apply(this, arguments)
            t = createTask(fn, { ...opts, ...inner })
            return t
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
