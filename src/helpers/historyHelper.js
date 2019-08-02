/**
 * Adds a new record to the resolve history.
 *
 * @param {Array<{}>} history
 * @param {string} itemName
 * @param {DecoratedFactory|Object} resolvedFactory
 * @returns {Array<{}>}
 */
function addToHistory(history, itemName, resolvedFactory) {
  const newRecord = {
    name: itemName,
    filepath: resolvedFactory.$filename || null,
    registerSource: resolvedFactory.$$registerSourceFile || null,
  };

  if (resolvedFactory.$$isUndefined) {
    newRecord.notFound = true;
  }

  return [...history, newRecord];
}

module.exports = {
  addToHistory,
};
