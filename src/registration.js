const {buildErrorWithStack} = require('./helpers/errorHelper');
const {addToHistory} = require('./helpers/historyHelper');
const {parseFactoryInject} = require('./injector');

/**
 * Registers the item in the dependency injector.
 *
 * @param {InjectorState} injectorState
 * @param {string} itemName
 * @param {DecoratedFactory} factory
 * @param {RegisterOptions} [options]
 * @returns {InjectorState}
 */
function registerFactory(injectorState, itemName, factory, options) {
  if (options.forceSingleton) {
    // Override the factory's singleton decorator to force it to be a singleton factory.
    factory.$singleton = true;
  }

  if (options.filename) {
    // Override the factory's filename path with the given one.
    factory.$filename = options.filename;
  }

  if (options.registerSourceFile) {
    factory.$$registerSourceFile = options.registerSourceFile;
  } else if (injectorState.meta.registerSourceFile) {
    factory.$$registerSourceFile = injectorState.meta.registerSourceFile;
  } else {
    factory.$$registerSourceFile = undefined;
  }

  const registerHistory = addToHistory([], itemName, factory);

  if (!options.skipTraceErrors && !injectorState.meta.skipTraceErrors) {
    validateFactory(factory, itemName, registerHistory);
  }

  factory.$inject = parseFactoryInject(factory, itemName, registerHistory);

  const newState = {
    ...injectorState,
    registered: {
      ...injectorState.registered,
      [itemName]: factory,
    },
  };

  return {
    state: newState,
  };
}

/**
 * Validates that the factory has the proper decorators defined before registering it.
 *
 * @param {DecoratedFactory} factory
 * @param {string} itemName
 * @param {Array<{}>} registerHistory
 * @throws {Error} - If the register source file for the factory is not defined.
 */
function validateFactory(factory, itemName, registerHistory) {
  if (!factory.$filename) {
    console.log( // eslint-disable-line no-console
      `FactoryDI Register Error: Warning: No $filename found for item '${itemName}' when being registered.`
      + ' Please make sure the $filename property is defined on this item\'s factory.'
    );
  }

  if (!factory.$$registerSourceFile) {
    throw buildErrorWithStack(
      `FactoryDI Register Error: Attempting to register '${itemName}' but no registerSource is defined.`
      + ' Please use factoryDi.setRegisterSource() to set this value'
      + ' or send {registerSourceFile: \'\'} as an option to factoryDi.register().',
      registerHistory
    );
  }
}

module.exports = {
  registerFactory,
};
