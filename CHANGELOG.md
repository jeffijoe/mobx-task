# Changelog

## 2.0.0

- TypeScript definitions for public API based on the DefinitelyTyped ones.
- Ported codebase to basic TypeScript. A lot of exotic things going on, so definitely not idiomatic.
- Added `TaskGroup` for combining task result reactions into a single state.

## 1.0.4

- Add name argument for `setState` action ([#18](https://github.com/jeffijoe/mobx-task/pull/18) by [@cyclops26](https://github.com/cyclops26))
- Update packages

## 1.0.3

- Add support for fields using arrow functions ([#12](https://github.com/jeffijoe/mobx-task/pull/12) by [@JulianWielga](https://github.com/JulianWielga))
- Update packages

## 1.0.2

- Update packages, attempt to fix CI build

## 1.0.1

- Remove babel runtime dependency, this was a mistake.

## 1.0.0

- **Breaking**: upgrade to MobX v5. No changes made to the code, should work with MobX v4 as well, but marking as breaking just in case.
- `args` field on state containing an array of arguments for the last task call. These are passed as arguments to the `pending` matcher.
- converted tests to Jest.

## 1.0.0-alpha.0

- **Breaking**: upgrade to MobX v4, breaks compatibility with MobX <= 3

## 0.2.3

- Legit fixed the `@autobind` issue that was supposed to be fixed in 0.2.2. My bad!

## 0.2.2

- Fixed issue with `@autobind` method decorator being applied first didn't work as promised.

## 0.2.1

- Fixed issue with not being able to reassign a decorated method.

## 0.2.0

- Fixed issue with state being shared between instances when using `task` as a decorator (#3).
  **This breaks compatibility with `autobind-decorator`**.

## 0.1.3

- Added `reset()` function.
- Added table of contents to readme.
- Added gotcha to docs about using with React Hot Loader/HMR.

## 0.1.2

- Fixed issue with state not updating when sync errors were thrown.

## 0.1.1

- Moved mobx to peerDependencies.

## 0.1.0

- First official release.
