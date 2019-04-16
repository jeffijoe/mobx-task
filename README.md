# mobx-task

[![npm](https://img.shields.io/npm/v/mobx-task.svg?maxAge=1000)](https://www.npmjs.com/package/mobx-task)
[![dependency Status](https://img.shields.io/david/jeffijoe/mobx-task.svg?maxAge=1000)](https://david-dm.org/jeffijoe/mobx-task)
[![devDependency Status](https://img.shields.io/david/dev/jeffijoe/mobx-task.svg?maxAge=1000)](https://david-dm.org/jeffijoe/mobx-task)
[![Build Status](https://img.shields.io/travis/jeffijoe/mobx-task.svg?maxAge=1000)](https://travis-ci.org/jeffijoe/mobx-task)
[![Coveralls](https://img.shields.io/coveralls/jeffijoe/mobx-task.svg?maxAge=1000)](https://coveralls.io/github/jeffijoe/mobx-task)
[![npm](https://img.shields.io/npm/dt/mobx-task.svg?maxAge=1000)](https://www.npmjs.com/package/mobx-task)
[![npm](https://img.shields.io/npm/l/mobx-task.svg?maxAge=1000)](https://github.com/jeffijoe/mobx-task/blob/master/LICENSE.md)
[![node](https://img.shields.io/node/v/mobx-task.svg?maxAge=1000)](https://www.npmjs.com/package/mobx-task)
[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)
[![TypeScript definitions on DefinitelyTyped](https://definitelytyped.org/badges/standard-flat.svg)](http://definitelytyped.org)

Takes the suck out of managing state for async functions in MobX.

Table of Contents
=================

   * [Installation](#installation)
   * [What is it?](#what-is-it)
   * [Full example with classes and decorators](#full-example-with-classes-and-decorators)
   * [Full example with plain observables](#full-example-with-plain-observables)
   * [How does it work?](#how-does-it-work)
   * [API documentation](#api-documentation)
      * [The task factory](#the-task-factory)
      * [As a decorator](#as-a-decorator)
      * [The task itself](#the-task-itself)
         * [`state`](#state)
         * [`pending`, `resolved`, `rejected`](#pending-resolved-rejected)
         * [`result`](#result)
         * [`args`](#args)
         * [`error`](#error)
         * [`match()`](#match)
         * [`wrap()`](#wrap)
         * [`setState()`](#setstate)
         * [`bind()`](#bind)
         * [`reset()`](#reset)
   * [Gotchas](#gotchas)
      * [Wrapping the task function](#wrapping-the-task-function)
      * [Using the decorator on React Components](#using-the-decorator-on-react-components)
      * [Using the decorator with `autobind-decorator`](#using-the-decorator-with-autobind-decorator)
      * [Using with `typescript`](#using-with-typescript)
   * [Author](#author)

# Installation

```
npm install --save mobx-task
```

# What is it?

`mobx-task` removes the boilerplate of maintaining loading and error state of async functions in MobX.

**Your code before:**

```js
class TodoStore {
  @observable fetchTodosRunning = true
  @observable fetchTodosError

  async fetchTodos () {
    try {
      runInAction(() => {
        this.fetchTodosRunning = true
      })
      // ...
      await fetch('/todos')
    } catch (err) {
      runInAction(() => {
        this.fetchTodosError = err
      })
      throw err
    } finally {
      runInAction(() => {
        this.fetchTodosRunning = false
      })
    }
  }
}
```

**Your code with `mobx-task`**

```js
import { task } from 'mobx-task'

class TodoStore {
  @task async fetchTodos () {
    await fetch('/todos')
  }
}
```

# Full example with classes and decorators

```js
import { observable, action } from 'mobx'
import { task } from 'mobx-task'
import React from 'react'
import { observer } from 'mobx-react'

class TodoStore {
  @observable todos = []

  @task async fetchTodos () {
    await fetch('/todos')
      .then(r => r.json())
      .then(action(todos => this.todos.replace(todos)))
  }
}

const store = new TodoStore()

// Start the task.
store.fetchTodos()

// and reload every 3 seconds, just cause..
setInterval(() => {
  store.fetchTodos()
}, 3000)

const App = observer(() => {
  return (
    <div>
      {store.fetchTodos.match({
        pending: () => <div>Loading, please wait..</div>,
        rejected: (err) => <div>Error: {err.message}</div>,
        resolved: () => (
          <ul>
            {store.todos.map(todo =>
              <div>{todo.text}</div>
            )}
          </ul>
        )
      })}
    </div>
  )
})
```

# Full example with plain observables

```js
import { observable, action } from 'mobx'
import { task } from 'mobx-task'
import React from 'react'
import { observer } from 'mobx-react'

const store = observable({
  todos: [],
  fetchTodos: task(async () => {
    await fetch('/todos')
      .then(r => r.json())
      .then(action(todos => store.todos.replace(todos)))
  })
})

// Start the task.
store.fetchTodos()

// and reload every 3 seconds, just cause..
setInterval(() => {
  store.fetchTodos()
}, 3000)

const App = observer(() => {
  return (
    <div>
      {store.fetchTodos.match({
        pending: () => <div>Loading, please wait..</div>,
        rejected: (err) => <div>Error: {err.message}</div>,
        resolved: () => (
          <ul>
            {store.todos.map(todo =>
              <div>{todo.text}</div>
            )}
          </ul>
        )
      })}
    </div>
  )
})
```

# How does it work?

`mobx-task` wraps the given function in another function which
does the state maintenance for you using MobX observables and computeds.
It also exposes the state on the function.

```js
const func = task(() => 42)

// The default state is `pending`.
console.log(func.state) // pending
console.log(func.pending) // true

// Tasks are always async.
func().then((result) => {
  console.log(func.state) // resolved
  console.log(func.resolved) // true
  console.log(func.pending) // false

  console.log(result) // 42

  // The latest result is also stored.
  console.log(func.result) // 42
})
```

It also maintains error state.

```js
const func = task(() => {
  throw new Error('Nope')
})

func().catch(err => {
  console.log(func.state) // rejected
  console.log(func.rejected) // true
  console.log(err) // Error('Nope')
  console.log(func.error) // Error('Nope')
})
```

And it's fully reactive.

```js
import { autorun } from 'mobx'

const func = task(async () => {
  return await fetch('/api/todos').then(r => r.json())
})

autorun(() => {
  // Very useful for functional goodness (like React components)
  const message = func.match({
    pending: () => 'Loading todos...',
    rejected: (err) => `Error: ${err.message}`,
    resolved: (todos) => `Got ${todos.length} todos`
  })

  console.log(message)
})

// start!
func().then(todos => { /*...*/ })
```

# API documentation

There's only a single exported member; `task`.

**ES6:**

```js
import { task } from 'mobx-task'
```

**CommonJS:**

```js
const { task } = require('mobx-task')
```

## The `task` factory

The top-level `task` creates a new task function and initializes it's state.

```
const myAwesomeFunc = task(async () => {
  return await doAsyncWork()
})

// Initial state is `pending`
console.log(myAwesomeFunc.state) // "pending"
```

Let's try to run it

```js
const promise = myAwesomeFunc()
console.log(myAwesomeFunc.state) // "pending"

promise.then((result) => {
  console.log('nice', result)
  console.log(myAwesomeFunc.state) // "resolved"
})
```

Parameters:

- `fn` - the function to wrap in a task.
- `opts` - options object. All options are _optional_.
  - `opts.state` - the initial state, default is `'pending'`.
  - `opts.error` - initial error object to set.
  - `opts.result` - initial result to set.
  - `opts.swallow` - if `true`, does not throw errors after catching them.

Additionally, the top-level `task` export has shortcuts for the `opts.state` option (except pending, since its the default).

- `task.resolved(func, opts)`
- `task.rejected(func, opts)`

For example:

```js
const func = task.resolved(() => 42)
console.log(func.state) // resolved
```

Is the same as doing:

```js
const func = task(() => 42, { state: 'resolved' })
console.log(func.state) // resolved
```

## As a decorator

The `task` function also works as a decorator.

> Note: you need to add `babel-plugin-transform-decorators-legacy` to your babel config for this to work.

Example:

```js
class Test {
  @task async load () {

  }

  // shortcuts, too
  @task.resolved async save () {

  }

  // with options
  @task({ swallow: true }) async dontCareIfIThrow() {

  }

  // options for shortcuts
  @task.rejected({ error: 'too dangerous lol' }) async whyEvenBother () {

  }
}
```

## The `task` itself

The thing that `task()` returns is the wrapped function including all that extra goodness.

### `state`

An observable string maintained while running the task.

Possible values:

- `"pending"` - waiting to complete or didn't start yet (default)
- `"resolved"` - done
- `"rejected"` - failed

### `pending`, `resolved`, `rejected`

Computed shorthands for `state`. E.g. `pending = state === 'pending'`

### `result`

Set after the task completes. If the task fails, it is set to `undefined`.

### `args`

An array of arguments that were used when the task function was invoked last.

### `error`

Set if the task fails. If the task succeeds, it is set to `undefined`.

### `match()`

Utility for pattern matching on the state.

Example:

```
const func = task((arg1, arg2, arg3, ..asManyAsYouWant) => 42)

const result = func.match({
  pending: (arg1, arg2, arg3, ...asManyAsYouWant) => 'working on it',
  rejected: (err) => 'failed: ' + err.message,
  resolved: (answer) => `The answer to the universe and everything: ${answer}`
})
```

### `wrap()`

Used to wrap the task in another function while preserving access to the state - aka. _Higher Order Functions_.

**Returns the new function, does not modify the original function.**

```js
// Some higher-order-function...
const addLogging = function (inner) {
  return function wrapped () {
    console.log('Started')
    return inner.apply(this, arguments).then(result => {
      console.log('Done!')
      return result
    })
  }
}

const func = task(() => 42)
const funcWithLogging = func.wrap(addLogging)
```

### `setState()`

Lets you set the internal state at any time for whatever reason you may have. Used internally as well.

Example:

```
const func = task(() => 42)

func.setState({ state: 'resolved', result: 1337 })
console.log(func.state) // 'resolved'
console.log(func.resolved) // true
console.log(func.result) // 1337
```

### `bind()`

The wrapped function patches `bind()` so the bound function contains the task state, too.
Other than that it functions exactly like `Function.prototype.bind`.

```
const obj = {
  value: 42,
  doStuff: task(() => this.value)
}

const bound = obj.doStuff.bind(obj)
bound()
console.log(bound.pending) // true
```

### `reset()`

Resets the state to what it was when the task was initialized.

This means if you use `const t = task.resolved(fn)`, calling `t.reset()` will set the state to `resolved`.

# Gotchas

## Wrapping the task function

It's important to remember that if you wrap the task in something else, you will loose the state.

**Bad:**

```
import once from 'lodash/once'

const func = task(() => 42)
const funcOnce = once(func)
console.log(funcOnce.pending) // undefined
```

This is nothing special, but it's a common gotcha when you like to compose your functions. We can make this work though,
by using `.wrap(fn => once(fn))`. See the [`wrap()`](#wrap) documentation.

**Good:**

```
import once from 'lodash/once'

const func = task(() => 42)
const funcOnce = func.wrap(once)
console.log(funcOnce.pending) // true
```

## Using the decorator on React Components

Using the `@task` decorator on React components is absolutely a valid use case, but if you use **React Hot Loader** or
any HMR technology that patches functions on components, you will loose access to the task state.

A workaround is to not use the decorator, but a property initializer:

```js
class Awesome extends React.Component {
  fetchTodos = task(() => {
    return fetch('/api/todos')
  })

  render () {
    return (
      <div>
        {this.fetchTodos.match(...)}
      </div>
    )
  }
}
```

## Using the decorator with `autobind-decorator`

Because of the way the `autobind-decorator` class decorator works, it won't pick up any `@task`-decorated
class methods because `@task` rewrites `descriptor.value` to `descriptor.get` which `autobind-decorator` does
not look for. This is due to the fact that `autobind-decorator` does not (and _should not_) evaluate getters.

You can either bind the tasks in the constructor, use field initializers, or apply the `@autobind` **method decorator** _before_ the `@task` decorator. `@task @autobind method() {}` is the correct order.

```js
import autobind from 'autobind-decorator'

@autobind
class Store {
  value = 42

  // Using decorator
  @task boo () {
    return this.value
  }

  // Using field initializer
  woo = task(() => {
    return this.value
  })

  // Decorator with autobind applied first
  @task @autobind woohoo () {
    return this.value
  }
}

// Nay
const store = new Store()
store.boo() // 42

const boo = store.boo
boo() // Error: cannot read property "value" of undefined

// Yay
store.woo() // 42

const woo = store.woo
woo() // 42

const woohoo = store.woohoo
woohoo() // 42
```

Alternatively, use `this.boo = this.boo.bind(this)` in the constructor.

## Using with `typescript`

Best way to work with typescript is to install `@types/mobx-task`. Definitions covers most use cases. The tricky part is decorators because they are not able to change the type of the decorated target. You will have to do type assertion or use plain observables.

```
npm install --save-dev @types/mobx-task
```

Example:

```ts
class Test {
  @task taskClassMethod(arg1: string, arg2: number) {
    let result: boolean
    ...
    return result
  }
  
  @task assertTypeHere = <Task<boolean, [string, number]>>((arg1: string, arg2: number) => {
    let result: boolean
    ...
    return result
  })
  
  @task assertTypeHereWithAs = ((arg1: string, arg2: number) => {
    let result: boolean
    ...
    return result
  }) as Task<boolean, [string, number]>
}

const test = new Test()

// dont care about task methods, props and return value and type
const doSomething = async () => {
  await test.taskClassMethod('a', 1)
  ...
}

// want to use task props and returned promise
(test.taskClassMethod as Task)("one", 2).then(...) // Task<any, any[]>
const {result} = <Task<Result>>test.taskClassMethod // Task<Result, any[]>
const {args} = test.taskClassMethod as Task<void, [string]>
```

# Author

Jeff Hansen - [@Jeffijoe](https://twitter.com/Jeffijoe)
