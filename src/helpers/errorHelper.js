/**
 * Builds an error with a stack that shows the resolve history instead of the code history.
 *
 * @param {string|Error} messageOrError
 * @param {Array<{}>} history
 * @param {boolean=} includeCodeStack
 * @returns {*|{}}
 */
function buildErrorWithStack(messageOrError, history, includeCodeStack) {
  let error = messageOrError || {};
  if (typeof messageOrError === 'string') {
    error = new Error(messageOrError);
  }

  const codeStack = error.stack;

  const previous = history.slice(0).reverse();

  error.stack = previous.reduce((errorStack, item) => {
    return errorStack
      + `\n    at ${item.name} (${item.filepath || '?'})`
      + `\n        registered in [${item.registerSource || '?'}]`;
  }, error.message || 'Error');

  if (includeCodeStack) {
    error.stack += '\n\nCode Stack\n' + codeStack;
  }

  return error;
}

module.exports = {
  buildErrorWithStack,
};
