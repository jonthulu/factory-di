const lodashForeach = require('lodash/forEach');

const {buildErrorWithStack} = require('./helpers/errorHelper');
const {addToHistory} = require('./helpers/historyHelper');

/**
 * The request for an item to be injected into the factory.
 *
 * @typedef {Object} InjectionRequest
 * @property {boolean} name - The name of the item to load from the DI.
 * @property {boolean} [isOptional] - Whether or not to throw an error if this item doesn't exist.
 * @property {boolean} [isPlaceholder] - Whether or not the item is a placeholder for a non-injected argument.
 * @property {boolean} [asFactory] - Whether or not to resolve the item to its factory instead of through the factory.
 */

/**
 * Character that when placed on the end of an argument indicates that the argument is optional.
 * @const {string}
 */
const OPTIONAL_CHARACTER = '?';

/**
 * Indicates that all function arguments should be considered placeholder arguments.
 * @const {symbol}
 */
const PLACEHOLDER_TYPE_ALL = Symbol('PlaceholderTypeAll');

/**
 * Indicates that only optional function arguments should be considered placeholder arguments.
 * @const {symbol}
 */
const PLACEHOLDER_TYPE_OPTIONAL = Symbol('PlaceholderTypeOptional');

/**
 * Indicates that only function arguments that exist in the given list should be considered placeholder arguments.
 * @const {symbol}
 */
const PLACEHOLDER_TYPE_LIST = Symbol('PlaceholderTypeList');

/**
 * The regexp for parsing the arguments from a function string.
 * @const {RegExp}
 */
const FUNCTION_ARGUMENT_REGEXP = /^(function[^(]*)?\(([^)]*)\)/;

/**
 * Registers the item in the dependency injector.
 *
 * @param {DecoratedFactory} factory
 * @param {string} itemName
 * @param {Array<{}>} registerHistory
 * @returns {Array<PlaceholderArgument|InjectionRequest>}
 */
function parseFactoryInject(factory, itemName, registerHistory) {
  try {
    if (!factory.$inject) {
      return parseFactoryPlaceholderArguments(factory, itemName, PLACEHOLDER_TYPE_ALL);
    } else if (factory.$inject === true) {
      return parseFactoryPlaceholderArguments(factory, itemName, PLACEHOLDER_TYPE_LIST);
    }

    const injectionArgs = parseFactoryInjectionArguments(factory);

    // Make sure all the arguments to the factory are accounted for.
    validateFunctionArgumentCount(factory, itemName, injectionArgs.length);

    return injectionArgs;
  } catch (placeholderError) {
    if (placeholderError.addToStack) {
      throw buildErrorWithStack(
        placeholderError.message.replace('%s', itemName),
        registerHistory
      );
    }

    throw placeholderError;
  }
}

/**
 * Parses the $inject array into injection request objects.
 *
 * @param {DecoratedFactory} factory
 * @returns {InjectionRequest[]}
 */
function parseFactoryInjectionArguments(factory) {
  const invalidIndexes = [];

  if (!Array.isArray(factory.$inject)) {
    const injectError = new Error(
      'FactoryDI Inject Error: Invalid non-array $inject found for \'%s\'.'
    );
    injectError.addToStack = true;
    throw injectError;
  }

  const injectionRequests = factory.$inject.map((injectionRequest, injectionIndex) => {
    if (injectionRequest && injectionRequest.name) {
      return injectionRequest;
    }

    if (typeof injectionRequest !== 'string') {
      invalidIndexes.push(injectionIndex);
      return null;
    }

    const safeName = injectionRequest.replace(/[^a-zA-Z0-9_$]/gi, '');
    if (!safeName) {
      invalidIndexes.push(injectionIndex);
    }

    const asFactory = (injectionRequest.indexOf('()') !== -1);
    const isOptional = (injectionRequest.slice(-1) === OPTIONAL_CHARACTER);
    const isPlaceholder = (injectionRequest.indexOf('*') !== -1);

    return {name: safeName, isOptional, asFactory, isPlaceholder};
  });

  if (invalidIndexes.length) {
    const injectError = new Error(
      `FactoryDI Inject Error: Invalid $inject found for '%s' on indexes: ${invalidIndexes.join(', ')}.`
    );
    injectError.addToStack = true;
    throw injectError;
  }

  return injectionRequests;
}

/**
 * Parses the arguments from the factory that will be defined on resolve instead of registered.
 *
 * @param {DecoratedFactory} factory
 * @param {string} itemName
 * @param {symbol} [placeholderType]
 * @returns {PlaceholderArgument[]}
 */
function parseFactoryPlaceholderArguments(factory, itemName, placeholderType) {
  let placeholderArgs;
  if (placeholderType === PLACEHOLDER_TYPE_LIST) {
    placeholderArgs = getFactoryPlaceholderOptions(factory);
  }

  // Gets the function definition string for the factory and uses a regex to parse the arguments.
  const argumentsMatch = factory.toString().match(FUNCTION_ARGUMENT_REGEXP);
  if (!argumentsMatch) {
    throw buildErrorWithStack(
      `FactoryDI Inject Error: Could not parse function arguments for '${itemName}'.`,
      addToHistory([], itemName, factory),
      true
    );
  }

  if (!argumentsMatch[2]) {
    // The arguments list is empty.
    return [];
  }

  // Remove all whitespace from the arguments list.
  const cleanedArguments = argumentsMatch[2].replace(/[\s\n]/g, '');
  if (!cleanedArguments) {
    return [];
  }

  // Map the function arguments to placeholder arguments.
  return cleanedArguments.split(',').reduce((final, functionArgument) => {
    if (!functionArgument) {
      // The final argument likely had a trailing comma, so skip this one.
      return final;
    }

    let isOptional = (functionArgument.indexOf('=') !== -1);
    const name = (isOptional) ? functionArgument.split('=')[0] : functionArgument;

    let isPlaceholder = (placeholderType === PLACEHOLDER_TYPE_ALL);
    if (placeholderType === PLACEHOLDER_TYPE_OPTIONAL) {
      isPlaceholder = Boolean(isOptional);
    } else if (placeholderType === PLACEHOLDER_TYPE_LIST) {
      const fromPlaceholder = placeholderArgs[name];
      if (fromPlaceholder) {
        isPlaceholder = true;
        isOptional = fromPlaceholder.isOptional;
      }
    }

    final.push(
      buildInjectionRequest(name, {isOptional, isPlaceholder})
    );
    return final;
  }, []);
}

/**
 * Gets the factory placeholder arguments option list.
 * If the factory is not sending an $inject array, it can instead define $placeholders in order to specify which
 * arguments are placeholder arguments and whether or not they are optional.
 *
 * @param {DecoratedFactory} factory
 * @returns {Object<name, {isOptional: boolean}>}
 * @throws {Error} - If factory $placeholders is invalid.
 */
function getFactoryPlaceholderOptions(factory) {
  const placeholders = factory.$placeholders || [];

  if (!Array.isArray(placeholders)) {
    const placeholderError = new Error('FactoryDI Inject Error: Non-array value of $placeholders found for \'%s\'.');
    placeholderError.addToStack = true;
    throw placeholderError;
  } else if (!placeholders.length) {
    return {};
  }

  const invalidIndexes = [];

  const parsedPlaceholderArgs = {};
  lodashForeach(placeholders, (placeholder, placeholderIndex) => {
    if (typeof placeholder !== 'string') {
      invalidIndexes.push(placeholderIndex);
      return;
    }

    const safeName = placeholder.replace(/[^a-zA-Z0-9_$]/gi, '');
    if (!safeName) {
      invalidIndexes.push(placeholderIndex);
    }

    const isOptional = (placeholder.slice(-1) === OPTIONAL_CHARACTER);

    parsedPlaceholderArgs[safeName] = {isOptional};
  });

  if (invalidIndexes.length) {
    const placeholderError = new Error(
      `FactoryDI Inject Error: Invalid $placeholders found for '%s' on indexes: ${invalidIndexes.join(', ')}.`
    );
    placeholderError.addToStack = true;
    throw placeholderError;
  }

  return parsedPlaceholderArgs;
}

/**
 * Builds a new injection request item.
 *
 * @param {string} name
 * @param {{isOptional: boolean, isPlaceholder: boolean, asFactory: boolean}} [optional]
 * @returns {InjectionRequest}
 */
function buildInjectionRequest(name, optional) {
  const safeOptions = {};
  lodashForeach(optional || {}, (optionValue, optionName) => {
    if (optionValue) {
      safeOptions[optionName] = true;
    }
  });

  return {
    ...safeOptions,
    name,
  };
}

/**
 * Validates that all the injection parameters are represented in the injection names ($inject).
 *
 * @param {DecoratedFactory} factory
 * @param {string} itemName
 * @param {number} factoryArgsCount
 * @throws {Error} - If the argument counts do not match.
 */
function validateFunctionArgumentCount(factory, itemName, factoryArgsCount) {
  const argsMatch = factory.toString().match(FUNCTION_ARGUMENT_REGEXP);
  if (!argsMatch) {
    throw buildErrorWithStack(
      `Factory Inject Error: Could not parse function argument count for '${itemName}'.`,
      addToHistory([], itemName, factory),
      true
    );
  }

  const expectedArgsCount = (argsMatch[2]) ? argsMatch[2].split(',').length : 0;

  if (factoryArgsCount !== expectedArgsCount) {
    throw buildErrorWithStack(
      `Factory Inject Error: Found ${factoryArgsCount} injected params for '${itemName}'`
      + `, but expected ${expectedArgsCount}.`
      + ' Make sure all the function arguments are represented in the factory.$inject variable.',
      addToHistory([], itemName, factory),
      true
    );
  }
}

module.exports = {
  parseFactoryInject,
};
