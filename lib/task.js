'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _extends = Object.assign || function (target) { for (var i = 1; i < arguments.length; i++) { var source = arguments[i]; for (var key in source) { if (Object.prototype.hasOwnProperty.call(source, key)) { target[key] = source[key]; } } } return target; };

var _require = require('mobx'),
    observable = _require.observable,
    computed = _require.computed,
    action = _require.action;

var _require2 = require('./utils'),
    proxyGetters = _require2.proxyGetters,
    promiseTry = _require2.promiseTry;

/**
 * Wraps the given function in a task function.
 *
 * @param  {Function} fn
 * @return {Task}
 */


function createTask(fn, opts) {
  opts = _extends({
    swallow: false,
    state: 'pending'
  }, opts);

  /**
   * The actual task function.
   */
  function task() {
    var _this = this,
        _arguments = arguments;

    return promiseTry(function () {
      task.setState({ state: 'pending', error: undefined, result: undefined });
      return Promise.resolve(fn.apply(_this, _arguments)).then(function (result) {
        task.setState({ state: 'resolved', error: undefined, result: result });
        return result;
      }).catch(function (err) {
        task.setState({ state: 'rejected', error: err, result: undefined });
        if (!opts.swallow) {
          throw err;
        }
      });
    });
  }

  var stateGetter = function stateGetter(state) {
    return computed(function () {
      return taskState.state === state;
    });
  };
  var taskStateSchema = {
    state: opts.state,
    error: observable.ref(opts.error),
    result: opts.result,
    pending: stateGetter('pending'),
    resolved: stateGetter('resolved'),
    rejected: stateGetter('rejected')
  };

  var taskStateSchemaKeys = Object.keys(taskStateSchema);
  var taskState = observable(taskStateSchema);

  setupTask(task, taskState, taskStateSchemaKeys);
  return task;
}

/**
 * Assigns the task methods and state to the given function.
 */
function setupTask(fn, taskState, taskStateSchemaKeys) {
  var setup = function setup(func) {
    return setupTask(func, taskState, taskStateSchemaKeys);
  };
  proxyGetters(fn, taskState, taskStateSchemaKeys);
  Object.assign(fn, {
    /**
     * Patch `bind` so we always return
     * the task function (with the additional properties)
     */
    bind: function bind() {
      for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
        args[_key] = arguments[_key];
      }

      var bound = Function.prototype.bind.apply(fn, args);
      return setup(bound);
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
    wrap: function wrap(wrapper) {
      return setup(wrapper(function wrapped() {
        return fn.apply(this, arguments);
      }));
    },
    /**
     * Assigns the given properties to the task.
     * E.g. task.setState({ state: 'resolved', result: 1337 })
     */
    setState: action(function (opts) {
      Object.assign(taskState, opts);
      return fn;
    }),
    /**
     * Given an object, returns the value for the key which equals the
     * current state, or undefined if not specified.
     */
    match: function match(obj) {
      var state = taskState.state;
      var match = obj[state];

      if (!match) {
        return undefined;
      }

      if (state === 'resolved') {
        return match(taskState.result);
      }

      if (state === 'rejected') {
        return match(taskState.error);
      }

      return match();
    }
  });
  return fn;
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
      return createTask(arg1, _extends({}, opts, arg2));
    }

    var makeDecorator = function makeDecorator(inner) {
      return function decorator(target, name, descriptor) {
        if (descriptor.value) {
          var fn = descriptor.value;
          delete descriptor.writable;
          delete descriptor.value;
          descriptor.value = createTask(fn, _extends({}, opts, inner));
        } else {
          var get = descriptor.get;
          var t = void 0;
          descriptor.get = function getter() {
            /* istanbul ignore next */
            if (t) {
              return t;
            }

            var fn = get.apply(this, arguments);
            t = createTask(fn, _extends({}, opts, inner));
            return t;
          };
        }
      };
    };

    // decorator invocation
    if (typeof arg2 === 'string') {
      // parameterless - @task method()
      return makeDecorator()(arg1, arg2, arg3);
    }

    // parameters - @task({ state: 'resolved' }) method()
    return makeDecorator(_extends({}, opts, arg1));
  };
}

var task = exports.task = taskCreatorFactory();
task.resolved = taskCreatorFactory({ state: 'resolved' });
task.rejected = taskCreatorFactory({ state: 'rejected' });
//# sourceMappingURL=task.js.map