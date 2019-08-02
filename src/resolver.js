const lodashSome = require('lodash/some');
const lodashPartial = require('lodash/partial');

const {buildErrorWithStack} = require('./helpers/errorHelper');
const {runFactory} = require('./runner');
const {addToHistory} = require('./helpers/historyHelper');

/**
 * The decorated factory.
 *
 * @typedef {function} DecoratedFactory
 * @property {InjectionRequest[]} $inject - The items that should be injected into the factory when resolving it.
 * @property {string} [$placeholders] - The list of function arguments that are placeholders.
 *                                      Used if $inject is not a list.
 * @property {boolean} [$singleton] - Whether or not to resolve this factory only once and always return the same value.
 * @property {string} [$filename] - The path to the factory (usually __filename in the factory file).
 * @property {string} [$$registerSourceFile] - The path to where the factory was registered (also usually __filename).
 * @property {PlaceholderArgument[]} [$$placeholderArgs] - The non-injected arguments the factory can take in.
 * @property {boolean} [$$isUndefined] - Whether or not this factory only returns undefined.
 * @property {boolean} [$$isSingleton] - Whether or not this factory only returns a singleton.
 */

/**
 * A placeholder argument.
 *
 * @typedef {Object} PlaceholderArgument
 * @property {string} name
 * @property {boolean} [isOptional] - Whether or not to throw an error if the placeholder argument is not provided.
 */

/**
 * Resolves the item as a factory.
 *
 * @param {InjectorState} injectorState
 * @param {string} itemName
 * @param {{}} resolveArgs
 * @param {Array<{}>} [resolveHistory] - The trace of every ancestor that was resolved before.
 * @param {{isOptional: boolean}} [options]
 * @returns {{resolvedFactory: DecoratedFactory, history: Array<{}>, state: InjectorState}}
 */
function resolveFactory(injectorState, itemName, resolveArgs, resolveHistory, options) {
  const safeResolveHistory = resolveHistory || [];

  // First check the singletons to see if it has already been resolved (as a singleton).
  if (injectorState.singletons[itemName]) {
    const resolvedFactory = resolveSingletonAsFactory(injectorState, itemName);

    return {
      resolvedFactory,
      history: addToHistory(safeResolveHistory, itemName, resolvedFactory),
      state: injectorState,
    };
  }

  const {isOptional} = (options || {});

  const registeredFactory = injectorState.registered[itemName];

  if (!registeredFactory) {
    // If the factory is optional and not found, then don't throw an error. Just return an factory for undefined.
    if (isOptional) {
      const resolvedFactory = getFactoryForUndefined();

      return {
        resolvedFactory,
        history: addToHistory(safeResolveHistory, itemName, resolvedFactory),
        state: injectorState,
      };
    }

    throw buildErrorWithStack(
      `FactoryDI Resolve Error: The item '${itemName}' has not been registered.`,
      addToHistory(safeResolveHistory, itemName, {})
    );
  }

  const safeResolveArgs = resolveArgs || {};

  // The registered factory is the valid factory, so update the history.
  const newResolveHistory = addToHistory(safeResolveHistory, itemName, registeredFactory);

  const injectData = dependencyInjectFactory(
    injectorState,
    registeredFactory,
    itemName,
    safeResolveArgs,
    newResolveHistory
  );

  const injectedFactory = injectData.factory;
  const newInjectorState = injectData.state;

  if (injectedFactory.$singleton) {
    const singletonInstance = runFactory(injectedFactory, resolveArgs, itemName, newResolveHistory);

    const newSingletonInjectorState = {
      ...newInjectorState,
      singletons: {
        ...newInjectorState.singletons,
        [itemName]: singletonInstance,
      },
    };

    return {
      resolvedFactory: resolveSingletonAsFactory(newSingletonInjectorState, itemName),
      history: newResolveHistory,
      state: newSingletonInjectorState,
    };
  }

  return {
    resolvedFactory: injectedFactory,
    history: newResolveHistory,
    state: injectorState,
  };
}

/**
 * Injects the factory's dependencies into it and returns a curried factory.
 *
 * @param {InjectorState} injectorState
 * @param {DecoratedFactory} factory
 * @param {string} itemName
 * @param {{}} resolveArgs
 * @param {Array<{}>} resolveHistory
 * @returns {{factory: DecoratedFactory, state: InjectorState}}
 */
function dependencyInjectFactory(injectorState, factory, itemName, resolveArgs, resolveHistory) {
  // The injection items will be defined as an array of names in the $inject variable on the factory function.
  const {$inject} = factory;

  // If inject is empty, we don't need to do anything here.
  if (!$inject || !$inject.length) {
    return {
      factory,
      state: injectorState,
    };
  }

  let updatedState = injectorState;

  const dependencies = $inject.map((injectItem) => {
    // Check to see if this item is a placeholder, which means it is provided at resolve time instead of registered.
    if (injectItem.isPlaceholder) {
      // Since we are using lodash.partial to curry, use its placeholder token.
      return lodashPartial.placeholder;
    }

    const injectionName = injectItem.name;

    // Detect if we are entering into a dependency injection loop and bail out unless it is a singleton.
    const isCyclic = (itemName === injectionName) || lodashSome(resolveHistory, (ancestor) => {
      return ancestor.name === injectionName;
    });
    if (isCyclic && !injectorState.singletons[injectionName]) {
      throw buildErrorWithStack(
        `FactoryDI Resolve Error: Cyclic dependency '${injectionName}' found while resolving dependency path.`,
        addToHistory(resolveHistory, injectionName, {})
      );
    }

    const safeInjectName = String(injectItem.name);
    const isOptional = Boolean(injectItem.isOptional);
    const asFactory = Boolean(injectItem.asFactory);

    const {resolvedFactory, state} = resolveFactory(
      updatedState,
      safeInjectName,
      resolveArgs,
      resolveHistory,
      {isOptional}
    );

    updatedState = state;

    if (asFactory) {
      return resolvedFactory;
    }

    return runFactory(resolvedFactory, resolveArgs, safeInjectName, resolveHistory);
  });

  return {
    factory: curryFactory(factory, dependencies),
    state: updatedState
  };
}

/**
 * Curries the factory, applying the given arguments to the function and returning a function that takes in
 * any remaining arguments.
 *
 * @param {DecoratedFactory} factory
 * @param {Array<*>} curryArgs
 * @returns {DecoratedFactory}
 */
function curryFactory(factory, curryArgs) {
  const curriedFactory = lodashPartial.apply(this, [factory, ...curryArgs]);

  // Store the placeholderArgs in the factory. These will be referenced in runInstance().
  curriedFactory.$$placeholderArgs = getPlaceholderArguments(factory);

  // Make sure the decorators carry through.
  ['$filename', '$$registerSourceFile', '$singleton'].forEach((decoratorName) => {
    if (factory[decoratorName]) {
      curriedFactory[decoratorName] = factory[decoratorName];
    }
  });

  return curriedFactory;
}

/**
 * Gets all the placeholder arguments from the factory injection items.
 *
 * @param {DecoratedFactory} factory
 * @returns {PlaceholderArgument[]}
 */
function getPlaceholderArguments(factory) {
  // The placeholder arguments are stored in the $inject along with all the others.
  const {$inject} = factory;

  if (!$inject || !$inject.length) {
    return [];
  }

  return $inject.filter((injectItem) => {
    return injectItem.isPlaceholder;
  });
}

/**
 * Resolves the singleton as a factory.
 *
 * @param {InjectorState} injectorState
 * @param {string} itemName
 * @returns {function}
 */
function resolveSingletonAsFactory(injectorState, itemName) {
  const resolvedSingleton = injectorState.singletons[itemName];

  // Wrap the singleton object in a factory wrapper.
  const singletonFactory = function singletonFactory() {
    return resolvedSingleton;
  };

  // Singletons don't support placeholder arguments.
  singletonFactory.$$placeholderArgs = [];

  // Set a system flag that shows this is a singleton factory.
  singletonFactory.$$isSingleton = true;

  return singletonFactory;
}

/**
 * Gets a factory that only returned undefined.
 *
 * @returns {function(): undefined}
 */
function getFactoryForUndefined() {
  const undefinedFactory = function undefinedFactory() {
    return undefined;
  };

  // The undefined factory doesn't support placeholder arguments.
  undefinedFactory.$$placeholderArgs = [];

  // Set a system flag that shows this is the undefined factory.
  undefinedFactory.$$isUndefined = true;

  return undefinedFactory;
}

module.exports = {
  resolveFactory,
};
