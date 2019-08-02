const {buildErrorWithStack} = require('./helpers/errorHelper');

/**
 * Runs the given factory using the resolve arguments.
 *
 * @param {DecoratedFactory} factory
 * @param {?Object<name, *>} resolveArgs - The arguments for all dependencies that do not exist in the injector.
 * @param {string} itemName - The name of the factory item.
 * @param {Array<{}>} resolveHistory - The trace of every ancestor that was resolved before.
 * @returns {*}
 */
function runFactory(factory, resolveArgs, itemName, resolveHistory) {
  const placeholderArgs = factory.$$placeholderArgs;
  if (!placeholderArgs) {
    // The factory does not accept any placeholder arguments, so just invoke it and return.
    return factory.apply(this);
  }

  const safeResolveArgs = resolveArgs || {};
  const argsForThisFactory = safeResolveArgs[itemName] || {};
  const argsForAllFactories = safeResolveArgs.common || {};

  const usableArgs = {
    ...argsForAllFactories,
    ...argsForThisFactory,
  };

  const resolveArgValues = placeholderArgs.map((placeholderArg) => {
    const {name, isOptional} = placeholderArg;

    if (usableArgs[name] !== undefined) {
      return usableArgs[name];
    } else if (isOptional) {
      return undefined;
    }

    throw buildErrorWithStack(
      `FactoryDI Run Error: Could not resolve instance of '${itemName}' because`
      + ` it requires a value for the non-injected '${name}' argument.`,
      resolveHistory
    );
  });

  return factory.apply(this, resolveArgValues);
}

module.exports = {
  runFactory,
};
