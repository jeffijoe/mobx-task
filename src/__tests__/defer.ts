export function defer<T>() {
  let resolve: ((value: T | PromiseLike<T>) => void) | undefined
  let reject: ((reason: unknown) => void) | undefined
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return {
    promise,
    resolve(v: T) {
      resolve!(v)
    },
    reject(err: unknown) {
      reject!(err)
    },
  }
}
