const {registerFactory} = require('./registration');
const {resolveFactory} = require('./resolver');
const {runFactory} = require('./runner');

/**
 * The injector state.
 *
 * @typedef {Object} InjectorState
 * @property {Object<name, DecoratedFactory>} registered - The map of registered factories.
 * @property {Object<name, *>} singletons - The map of resolved singleton items.
 * @property {{registerSourceFile: ?string}} meta - The injector meta data.
 */

/**
 * The register options.
 *
 * @typedef {Object} RegisterOptions
 * @property {string} [filename] - Defines a factory filename path if the given factoryOrItem does not have one.
 * @property {boolean} [forceSingleton] - Whether or not to force the function to resolve as a singleton.
 * @property {boolean} [skipTraceErrors] - Whether or not to ignore errors from missing filename and/or source file.
 * @property {string} [registerSourceFile] - The filename path of where register() was called for this item.
 */

/**
 * Creates a new factory dependency injection object.
 *
 * @returns {{}}
 */
function factoryDiFactory() {
  /**
   * The map of registered items.
   *
   * @type {{}}
   */
  const registered = {};

  /**
   * Already resolved items that need to only resolve once.
   *
   * @type {{}}
   */
  const singletons = {};

  /**
   * The injector meta data.
   *
   * @type {{}}
   */
  const meta = {};

  /**
   * The injector data that defines the state of the injector.
   *
   * @type {InjectorState}
   */
  const injectorState = {
    registered,
    singletons,
    meta,
  };

  /**
   * The factory dependency injection object.
   *
   * @type {{}}
   */
  const factoryDi = {
    register,
    resolve,
    setRegisterSource,
    setSkipTraceErrors,
    clearSingletons,
  };
  factoryDi.$filename = __filename;

  /**
   * Updates the injector state using the given new state.
   *
   * @param {InjectorState} newState
   */
  function updateInjectorState(newState) {
    injectorState.registered = newState.registered;
    injectorState.singletons = newState.singletons;
    injectorState.meta = newState.meta;
  }

  /**
   * Registers a new item in the injector.
   *
   * @param {string} itemName
   * @param {DecoratedFactory|*} factoryOrItem
   * @param {RegisterOptions} [options]
   * @throws {Error} - On invalid item name.
   */
  function register(itemName, factoryOrItem, options) {
    if (!itemName) {
      throw new Error('FactoryDI Register Error: No item name given.');
    } else if (typeof itemName !== 'string') {
      throw new Error('FactoryDI Register Error: The given item name is not a string.');
    }

    // Assume any functions given are factories.
    let safeFactory = factoryOrItem;

    if (typeof factoryOrItem !== 'function') {
      // Wrap non-functions in a factory.
      const itemFactory = function itemFactory() {
        return factoryOrItem;
      };
      itemFactory.$singleton = true;

      if (factoryOrItem && factoryOrItem.$filename) {
        itemFactory.$filename = factoryOrItem.$filename;
      }

      safeFactory = itemFactory;
    }

    const {state} = registerFactory(injectorState, itemName, safeFactory, options || {});

    updateInjectorState(state);
  }

  /**
   * Gets the item from the injector with all of its dependencies fulfilled.
   *
   * @param {string} itemName
   * @param {{}} [resolveArgs] - The arguments for all dependencies that do not exist in the injector.
   * @param {{}} [options]
   * @param {boolean} [options.asFactory] - Whether or not to resolve the item to its factory instead of through
   *                                        the factory.
   * @returns {*}
   * @throws {Error} - On invalid item name.
   */
  function resolve(itemName, resolveArgs, options) {
    if (!itemName) {
      throw new Error('FactoryDI Register Error: No item name given.');
    } else if (typeof itemName !== 'string') {
      throw new Error('FactoryDI Register Error: The given item name is not a string.');
    }

    const safeOptions = options || {};

    const {resolvedFactory, state, history} = resolveFactory(injectorState, itemName, resolveArgs);

    updateInjectorState(state);

    if (safeOptions.asFactory) {
      return resolvedFactory;
    }

    return runFactory(resolvedFactory, resolveArgs, itemName, history);
  }

  /**
   * Sets the register source file in the injector.
   *
   * @param {string} registerSourceFile - The filepath to the file where the next registration calls will take place.
   *                                      This is usually set to the __filename variable.
   * @returns {?string} - The previous register source file.
   */
  function setRegisterSource(registerSourceFile) {
    const currentSourceFile = injectorState.meta.registerSourceFile;

    injectorState.meta.registerSourceFile = registerSourceFile;

    return currentSourceFile || null;
  }

  /**
   * Sets whether or not the di should skip the trace errors.
   *
   * @param {boolean} skipTraceErrors
   */
  function setSkipTraceErrors(skipTraceErrors) {
    injectorState.meta.skipTraceErrors = Boolean(skipTraceErrors);
  }

  /**
   * Clears all the singleton objects.
   */
  function clearSingletons() {
    injectorState.singletons = {};
  }

  // Have the factory register itself so it can be injected.
  factoryDi.register('factoryDi', factoryDi, {
    registerSourceFile: __filename || 'factory-di/src/index.js',
  });

  return factoryDi;
}

module.exports = factoryDiFactory;
