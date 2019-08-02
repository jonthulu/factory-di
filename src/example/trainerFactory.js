/**
 * The trainer factory.
 *
 * @param {{speak: function}} cat
 * @param {{speak: function}} dog
 * @param {{speak: function}} [pig]
 * @returns {{speak: function, speakAll: function}}
 */
function trainerFactory(cat, dog, pig = null) {
  return {
    speak: (animal) => {
      if (animal === 'cat') {
        return cat.speak();
      } else if (animal === 'dog') {
        return dog.speak();
      } else if (animal === 'pig') {
        return (pig) ? pig.speak() : '*silence*';
      }
      return 'We don\'t have one of those...';
    },

    speakAll: () => {
      return {
        cat: cat.speak(),
        dog: dog.speak(),
        pig: (pig) ? pig.speak() : '*silence*',
      };
    },
  };
}

module.exports = trainerFactory;

module.exports.$inject = true;
module.exports.$placeholders = ['pig?'];
module.exports.$filename = __filename;
