/* eslint-disable require-jsdoc, max-len */

const ava = require('ava');

const factoryDiFactory = require('./index');

function getDiInstance() {
  const factoryDi = factoryDiFactory();
  factoryDi.setSkipTraceErrors(true);
  return factoryDi;
}

ava('Each factory call creates a unique container.', (test) => {
  test.not(getDiInstance(), getDiInstance());
});

ava('Can resolve a registered string.', (test) => {
  const factoryDi = getDiInstance();

  const name = 'test';
  const value = 'testString';

  factoryDi.register(name, value);
  test.is(value, factoryDi.resolve(name));
});

ava('Can resolve a registered object.', (test) => {
  const factoryDi = getDiInstance();

  const name = 'test';
  const value = {
    cat: 'meow',
    dog: 'woof',
  };

  factoryDi.register(name, value);
  test.is(value, factoryDi.resolve(name));
});

ava('Can resolve a registered factory.', (test) => {
  const factoryDi = getDiInstance();

  const name = 'test';
  const value = function testFactory() {
    return {
      test: true
    };
  };

  factoryDi.register(name, value);
  test.deepEqual(value(), factoryDi.resolve(name));
});

ava('Can resolve a registered factory as the factory.', (test) => {
  const factoryDi = getDiInstance();

  const name = 'test';
  const value = function testFactory() {
    return {
      test: true
    };
  };

  factoryDi.register(name, value);
  test.deepEqual(value, factoryDi.resolve(name, null, {asFactory: true}));
});

ava('Can resolve a registered factory with placeholder arguments.', (test) => {
  const factoryDi = getDiInstance();

  const name = 'test';
  const placeholder = 'meow';

  const value = function testFactory(resolveArg) {
    return {
      resolveArg,
      test: true
    };
  };

  factoryDi.register(name, value);

  test.deepEqual(
    value(placeholder),
    factoryDi.resolve(name, {
      [name]: {resolveArg: placeholder}
    }),
    'Resolved using item name in resolve arguments.'
  );

  test.deepEqual(
    value(placeholder),
    factoryDi.resolve(name, {
      common: {resolveArg: placeholder}
    }),
    'Resolved using \'common\' in resolve arguments.'
  );

  const wrongNameError = test.throws(
    () => {
      factoryDi.resolve(name, {
        wrongName: {resolveArg: placeholder}
      })
    },
    Error,
    'Resolved using the wrong item name will throw an error.'
  );

  if (wrongNameError.message.match(`Could not resolve instance of '${name}' because it requires a value for the non-injected 'resolveArg' argument`)) {
    test.pass();
  } else {
    test.fail('Wrong error message found: ' + wrongNameError.message);
  }
});

ava('Throws an error if invalid resolve arguments are given.', (test) => {
  const factoryDi = getDiInstance();

  const name = 'test';
  const placeholder = 'meow';

  const value = function testFactory(resolveArg) {
    return {
      resolveArg,
      test: true
    };
  };

  factoryDi.register(name, value);

  const resolveArgArray = test.throws(
    () => {
      factoryDi.resolve(name, [placeholder])
    },
    Error,
    'Resolved using the wrong item name will throw an error.'
  );

  if (resolveArgArray.message.match(`Could not resolve instance of '${name}' because it requires a value for the non-injected 'resolveArg' argument`)) {
    test.pass();
  } else {
    test.fail('Wrong error message found: ' + resolveArgArray.message);
  }

  const resolveArgString = test.throws(
    () => {
      factoryDi.resolve(name, placeholder)
    },
    Error,
    'Resolved using the wrong item name will throw an error.'
  );

  if (resolveArgString.message.match(`Could not resolve instance of '${name}' because it requires a value for the non-injected 'resolveArg' argument`)) {
    test.pass();
  } else {
    test.fail('Wrong error message found: ' + resolveArgArray.message);
  }

  test.throws(
    () => {
      factoryDi.resolve(name, placeholder)
    },
    Error,
    'Resolved using an invalid resolve args will throw an error.'
  );
});

ava('Can resolve a singleton object through $singleton.', (test) => {
  const factoryDi = getDiInstance();

  const name = 'test';
  const value = function testFactory() {
    return {
      test: true
    };
  };
  value.$singleton = true;

  factoryDi.register(name, value);
  test.is(factoryDi.resolve(name), factoryDi.resolve(name));
});

ava('Resolves a unique object each time if $singleton is not true.', (test) => {
  const factoryDi = getDiInstance();

  const name = 'test';
  const value = function testFactory() {
    return {
      test: true
    };
  };

  factoryDi.register(name, value);
  test.not(factoryDi.resolve(name), factoryDi.resolve(name));
});

ava('Can resolve a singleton object through forceSingleton.', (test) => {
  const factoryDi = getDiInstance();

  const name = 'test';
  const value = function testFactory() {
    return {
      test: true
    };
  };

  factoryDi.register(name, value, {forceSingleton: true});
  test.is(factoryDi.resolve(name), factoryDi.resolve(name));
});

ava('Can resolve a sub-dependency.', (test) => {
  const factoryDi = getDiInstance();

  const cOutput = {c: true};

  function aFactory(c) {
    return c;
  }
  aFactory.$inject = ['c'];

  function bFactory(c) {
    return c;
  }
  bFactory.$inject = true;

  function cFactory() {
    return cOutput;
  }

  factoryDi.register('c', cFactory);
  factoryDi.register('b', bFactory);
  factoryDi.register('a', aFactory);
  test.deepEqual(cOutput, factoryDi.resolve('a'), 'Inject using arguments list');
  test.deepEqual(cOutput, factoryDi.resolve('b'), 'Inject using TRUE');
});

ava('Throws an error if $inject is not an array.', (test) => {
  const factoryDi = getDiInstance();

  const aName = 'a';
  function aFactory(b) {
    return b;
  }

  aFactory.$inject = {b: true};

  try {
    factoryDi.register(aName, aFactory);

    test.fail('No error thrown.');
  } catch (error) {
    if (error.message.indexOf(`Invalid non-array $inject found for '${aName}'`) !== -1) {
      test.pass();
    } else {
      test.fail('Wrong error message found: ' + error.message);
    }
  }
});

ava('Throws an error if dependency can not be found.', (test) => {
  const factoryDi = getDiInstance();

  const aName = 'a';
  const bName = 'b';
  const cName = 'c';

  function aFactory(c) {
    return c;
  }
  aFactory.$inject = [cName];

  function bFactory(c) {
    return c;
  }
  bFactory.$inject = true;

  factoryDi.register(aName, aFactory);
  factoryDi.register(bName, bFactory);

  try {
    factoryDi.resolve(aName);

    test.fail('No error thrown.');
  } catch (error) {
    if (error.message.match(`The item '${cName}' has not been registered`)) {
      test.pass();
    } else {
      test.fail('Wrong error message found: ' + error.message);
    }
  }

  try {
    factoryDi.resolve(bName);

    test.fail('No error thrown.');
  } catch (error) {
    if (error.message.match(`The item '${cName}' has not been registered`)) {
      test.pass();
    } else {
      test.fail('Wrong error message found: ' + error.message);
    }
  }
});

ava('Can resolve a sub-dependency as a factory.', (test) => {
  const factoryDi = getDiInstance();

  const cOutput = {c: true};

  function aFactory(c) {
    return c();
  }
  aFactory.$inject = ['c()'];

  function cFactory() {
    return cOutput;
  }

  factoryDi.register('c', cFactory);
  factoryDi.register('a', aFactory);
  test.is(cOutput, factoryDi.resolve('a'), 'Inject using arguments list');
});

ava('Can resolve a sub-dependency with extra arguments.', (test) => {
  const factoryDi = getDiInstance();

  const zValue = 'zSuccess';

  function aFactory(c) {
    return c;
  }
  aFactory.$inject = ['c'];

  function bFactory(c) {
    return c;
  }
  bFactory.$inject = true;

  function cFactory(z) {
    return z;
  }

  factoryDi.register('a', aFactory);
  factoryDi.register('b', bFactory);
  factoryDi.register('c', cFactory);

  test.deepEqual(zValue, factoryDi.resolve('a', {
    c: {z: zValue}
  }));

  test.deepEqual(zValue, factoryDi.resolve('b', {
    c: {z: zValue}
  }));
});

ava('Can resolve a dependency if the $inject parameter is set to true and $placeholders is defined.', (test) => {
  const factoryDi = getDiInstance();

  const zValue = 'zSuccess';

  function aFactory(c) {
    return c;
  }
  aFactory.$inject = ['c'];

  function cFactory(z) {
    return z;
  }
  cFactory.$inject = true;
  cFactory.$placeholders = ['z'];

  factoryDi.register('a', aFactory);
  factoryDi.register('c', cFactory);

  test.deepEqual(zValue, factoryDi.resolve('a', {
    c: {z: zValue}
  }));
});

ava('Can resolve a dependency if extra arguments are optional and none are given.', (test) => {
  const factoryDi = getDiInstance();

  function aFactory(c) {
    return c;
  }
  aFactory.$inject = ['c'];

  function bFactory(d) {
    return d;
  }
  bFactory.$inject = ['d'];

  function cFactory(z) {
    return z;
  }
  cFactory.$inject = true;
  cFactory.$placeholders = ['z?'];

  function dFactory(z = 'defaultZ') {
    return z;
  }
  dFactory.$inject = true;

  factoryDi.register('a', aFactory);
  factoryDi.register('b', bFactory);
  factoryDi.register('c', cFactory);
  factoryDi.register('d', dFactory);

  test.deepEqual(undefined, factoryDi.resolve('a'));
  test.deepEqual('defaultZ', factoryDi.resolve('b'));
});

ava('Can resolve a dependency if some extra arguments are optional and some are not.', (test) => {
  const factoryDi = getDiInstance();

  const zValue = 'zSuccess';

  function aFactory(c) {
    return c;
  }
  aFactory.$inject = ['c'];

  function cFactory(y, z) {
    return {y, z};
  }
  cFactory.$inject = true;
  cFactory.$placeholders = ['y?', 'z'];

  factoryDi.register('a', aFactory);
  factoryDi.register('c', cFactory);

  test.deepEqual({y: undefined, z: zValue}, factoryDi.resolve('a', {
    c: {z: zValue},
  }));
});

ava('Can resolve the factoryDi instance.', (test) => {
  const factoryDi = getDiInstance();

  const aName = 'a';
  const bName = 'b';
  const bValue = {b: true};

  function aFactory(injectedDiContainer) {
    return injectedDiContainer;
  }
  aFactory.$inject = ['factoryDi'];

  function bFactory() {
    return bValue;
  }

  factoryDi.register(aName, aFactory);
  factoryDi.register(bName, bFactory);

  const resolved = factoryDi.resolve(aName);
  test.is(factoryDi, resolved);
  test.is(bValue, resolved.resolve(bName));
});

ava('Can clear singletons.', (test) => {
  const factoryDi = getDiInstance();

  const name = 'test';
  const value = function testFactory() {
    return {test: true};
  };
  value.$singleton = true;

  factoryDi.register(name, value);

  const first = factoryDi.resolve(name);
  factoryDi.clearSingletons();

  const second = factoryDi.resolve(name);

  test.not(first, second);
  test.deepEqual(first, second);
});

ava('Throws an error if register name is false or an empty string.', (test) => {
  const factoryDi = getDiInstance();

  function testFactory() {
    return {test: true};
  }

  try {
    factoryDi.register(false, testFactory);
    test.fail('The item was successfully registered with a falsy name.');
  } catch (error) {
    if (error.message.match('No item name given')) {
      test.pass();
    } else {
      test.fail('Wrong error message: ' + error.message);
    }
  }

  try {
    factoryDi.register('', testFactory);
    test.fail('The item was successfully registered with a falsy name.');
  } catch (error) {
    if (error.message.match('No item name given')) {
      test.pass();
    } else {
      test.fail('Wrong error message: ' + error.message);
    }
  }
});

ava('Throws an error if resolve name is false or an empty string.', (test) => {
  const factoryDi = getDiInstance();

  try {
    factoryDi.resolve(false);
    test.fail('The item was successfully resolved with a falsy name.');
  } catch (error) {
    if (error.message.match('No item name given')) {
      test.pass();
    } else {
      test.fail('Wrong error message: ' + error.message);
    }
  }

  try {
    factoryDi.resolve('');
    test.fail('The item was successfully resolved with a falsy name.');
  } catch (error) {
    if (error.message.match('No item name given')) {
      test.pass();
    } else {
      test.fail('Wrong error message: ' + error.message);
    }
  }
});

ava('Throws an error if a cyclic dependency is found.', (test) => {
  const factoryDi = getDiInstance();

  const aName = 'a';

  function aFactory(b) {
    return {a: true, ...b};
  }
  aFactory.$inject = ['b'];

  function bFactory(a) {
    return {b: true, ...a};
  }
  bFactory.$inject = ['a'];

  factoryDi.register('a', aFactory);
  factoryDi.register('b', bFactory);

  try {
    factoryDi.resolve(aName);

    test.fail('No error thrown.');
  } catch (error) {
    if (error.message.match(`Cyclic dependency '${aName}' found while resolving dependency path`)) {
      test.pass();
    } else {
      test.fail('Wrong error message found: ' + error.message);
    }
  }
});

ava('Throws an error if injection names are invalid.', (test) => {
  const factoryDi = getDiInstance();

  const aName = 'a';

  function aFactory(b) {
    return b;
  }
  aFactory.$inject = [false];

  try {
    factoryDi.register(aName, aFactory);

    test.fail('No error thrown.');
  } catch (error) {
    if (error.message.indexOf(`Invalid $inject found for '${aName}'`) !== -1) {
      test.pass();
    } else {
      test.fail('Wrong error message found: ' + error.message);
    }
  }
});
