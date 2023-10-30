/**
 * Proxies getters on the target to the object.
 *
 * @param  {Object} target
 * The proxy to add getters to.
 *
 * @param  {Object} obj
 * Object with properties we want to proxy getters to.
 *
 * @params {string[]} keys
 * The keys to proxy.
 */
export function proxyGetters<T, U>(
  target: T,
  obj: U,
  keys: Array<keyof U>,
): void {
  keys.forEach((key) => {
    Object.defineProperty(target, key, {
      get: () => obj[key],
    })
  })
}

/**
 * Invokes the function in a promise-safe way.
 */
export function promiseTry<R>(
  fn: () => R,
): R extends Promise<infer P> ? Promise<P> : Promise<R> {
  return new Promise<any>((resolve, reject) => {
    try {
      resolve(fn())
    } catch (err) {
      reject(err)
    }
  }) as any
}
