/* eslint-disable no-console */

const factoryDiFactory = require('../index');

const catFactory = require('./catFactory');
const dogFactory = require('./dogFactory');
const trainerFactory = require('./trainerFactory');

const pig = {
  speak: () => {
    return 'oink';
  },
};

const factoryDi = factoryDiFactory();

factoryDi.setRegisterSource(__filename);
factoryDi.register('cat', catFactory);
factoryDi.register('dog', dogFactory);
factoryDi.register('trainer', trainerFactory);

const urbanTrainer = factoryDi.resolve('trainer');
const farmTrainer = factoryDi.resolve('trainer', {
  trainer: {pig}
});

console.log('Animal Trainers show off their skills:');
console.log('All pets sound off:', urbanTrainer.speakAll());
console.log('Farm yard sound off:', farmTrainer.speakAll());
