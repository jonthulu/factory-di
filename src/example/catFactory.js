/**
 * The cat factory.
 *
 * @returns {{speak: (function(): string)}}
 */
function catFactory() {
  return {
    speak: () => {
      return 'meow';
    },
  };
}

module.exports = catFactory;

module.exports.$filename = __filename;
