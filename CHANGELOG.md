# Changelog

## 1.0.0

* **Breaking**: upgrade to MobX v4, breaks compatibility with MobX <= 3

## 0.2.3

* Legit fixed the `@autobind` issue that was supposed to be fixed in 0.2.2. My bad!

## 0.2.2

* Fixed issue with `@autobind` method decorator being applied first didn't work as promised.

## 0.2.1

* Fixed issue with not being able to reassign a decorated method.

## 0.2.0

* Fixed issue with state being shared between instances when using `task` as a decorator (#3).
  **This breaks compatibility with `autobind-decorator`**.

## 0.1.3

* Added `reset()` function.
* Added table of contents to readme.
* Added gotcha to docs about using with React Hot Loader/HMR.

## 0.1.2

* Fixed issue with state not updating when sync errors were thrown.

## 0.1.1

* Moved mobx to peerDependencies.

## 0.1.0

* First official release.
