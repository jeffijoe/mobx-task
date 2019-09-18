export function defer<T>() {
  let resolve: Function
  let reject: Function
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return {
    promise,
    resolve<T>(v: T) {
      resolve(v)
    },
    reject(err: unknown) {
      reject(err)
    }
  }
}
