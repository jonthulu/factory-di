/**
 * The dog factory.
 *
 * @returns {{speak: (function(): string)}}
 */
function dogFactory() {
  return {
    speak: () => {
      return 'bark';
    },
  };
}

module.exports = dogFactory;

module.exports.$filename = __filename;
