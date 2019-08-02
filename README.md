Factory Dependency Injector
===========================

A function factory based dependency injector for NodeJS.

### The Problem

I wanted to write a dependency injector that is more functional in nature for NodeJS.
Doing a quick scan of npm, all the injectors I found depended on the `new` keyword.
This new DI needs to use function based factories instead of instantiatable objects and
be simple to use, but still be powerful enough to support an entire framework.

### The Solution

I based the usage off the Angular 1 dependency injector such as using $ variables to indicate
special properties on the factories ($inject) and sending a list of what should be injected.
However, as the project evolved, many more options were added than is available in Angular 1.

It supports:
* Auto injects child dependencies.
* Supports auto detection of factory arguments.
* Supports resolving of arguments that have not been registered with the injector.
* Supports optional argument injection.
* Supports singleton/caching on registration.
* Supports injecting the injector itself into a factory.

Variable names that begin with $ indicate a public factory variable. Variables that begin with $$ indicate
a private factory variable.

#### Usage
This project is not yet on npm, so it requires the module being included in parent code.
```js
const factoryDi = require('./modules/factoryDi');
```

#### Example
A simple example program can be found in `src/example` and run using:
```bash
npm run example
```

For now, the example and tests are the best way to see how to use the code.

####Tests
Tests were built using AVA.
```bash
npm test
```

####Linting
Linting is done using eslint.
```bash
npm run lint
```

#### What Is Left To Do / Could Be Done Better
* Add ability to clone factoryDi.
* Updated README with full documentation on how to use.
* More Tests
* More comprehensive example.
* Add support for lazy dependency resolution.
* Add support for aliases.
* I am not sure if the state should be immutable or if I should just mutate it be reference.
* Possibly move all JSDoc definitions to a special file.
* When NodeJS imports are not experimental, update code to use them.


Documentation
-------------

*Note: This documentation assumes the project is available using 'factory-di'. This can be setup using `npm link` or `yarn link`.

First require 'factory-di'. This will return a factoryDi factory.
Each time you call this, you can generate a new dependency injection container.

```js
const factoryDi = require('factory-di')();
```

In order to use the dependency injector, each dependency must be defined before it can be injected.
It can be defined directly (if not a function) or through the use of a factory function using the register() method.
Since 'factory-di' returns a factory, make sure to export your container instance so it can be referenced elsewhere
in the code.

```js
// File di.js
const factoryDi = require('factory-di')();

const someDependencyFactory = require('./someDependency.js');

const staticValue = 'someStaticValueOrObject';

factoryDi.register('someDependency', someDependencyFactory);
factoryDi.register('staticValue', staticValue, {filename: __filename});

module.exports = factoryDi;
```

Each factory can depend upon other dependencies that can be auto-injected by the factoryDi using the $inject array.
Let's create a factory with a dependency:
```js
// File someDependency.js
module.exports = function someDependencyFactory(staticValue) {
  console.log(staticValue === 'someStaticValueOrObject'); // Returns true.
  return {
    doSomething: true
  };
};

module.exports.$inject = ['staticValue'];
module.exports.$filename = __filename;
```

Now in order to actually get the value of our di factory, use the resolve() method.

```js
// (di.js) is from the above example.
const factoryDi = require('./di.js');

const someDependency = factoryDi.resolve('someDependency');
```

You can pass extra parameters on factory functions down through the dependency injection when resolve() is called.
These parameters must be defined in the $inject array, but they must have a '\*' on the end. These extra parameters
can be optional if they have '\*?' on the end(see the 'Optional Arguments' section below).

Let's build a new dependency that takes in an extra argument.
```js
// File otherDependency.js
module.exports = function otherDependencyFactory(staticValue, isBlue) {
  console.log('isBlue', isBlue);
  return {
    doSomethingElse: true
  };
};

module.exports.$inject = ['staticValue', 'isBlue*'];
module.exports.$filename = __filename;
```

Now let's register it with the factoryDi and resolve it.
```js
// File di.js
const factoryDi = require('factory-di')();

factoryDi.register('staticValue', true);
factoryDi.register('otherDependency', otherDependencyFactory);

factoryDi.resolve('otherDependency', {
  otherDependency: {isBlue: true}
});
// We will see 'isBlue true' if this were logged.

// By specifying a new key, we can send arguments to a deeper dependency.
factoryDi.resolve('otherDependency', {
  otherDependency: {isBlue: true},
  deeperDependency: {deeper: true},
});
```

Now let's send an extra argument down two levels of dependencies.
First we will define a third dependency that depends on the otherDependency.
```js
// File thirdDependency.js
module.exports = function thirdDependencyFactory(otherDependency, isGreen) {
  console.log('isGreen', isGreen);
  return {
    doAnything: true
  };
};

module.exports.$inject = ['otherDependency', 'isGreen*'];
module.exports.$filename = __filename;
```

Now let's register it with the factoryDi and resolve it.
```js
// File di.js
const factoryDi = require('factory-di')();

factoryDi.register('otherDependency', otherDependencyFactory);
factoryDi.register('thirdDependency', thirdDependencyFactory);

factoryDi.resolve('otherDependency', {
  otherDependency: {isBlue: true},
  thirdDependency: {isGreen: false}
});
// We will see 'isBlue true' and 'isGreen false' in the console log.
```

Shortcut for $inject
--------------------
To make things easier, you can simply send `true` to the $inject parameter and the arguments will be automatically
detected.
```js
module.exports = function shortcutFactory(dependency1, dependency2) {
  return {
    doSomething: dependency1.doSomething,
    doSomethingElse: dependency2.doSomething
  };
};

module.exports.$inject = true;
module.exports.$filename = __filename;
```

If any of the arguments are to be injected during the resolve process, you must define `$placeholders` on the factory
with the name of the resolve arguments. Otherwise, the argument will attempt to be injected. Notice how you do not need
the '*' inside the $placeholders array.
```js
module.exports = function shortcutFactory(dependency1, dependency2, isGreen) {
  console.log('isGreen', isGreen);
  return {
    doSomething: dependency1.doSomething,
    doSomethingElse: dependency2.doSomething
  };
};

module.exports.$inject = true;
module.exports.$placeholders = ['isGreen'];
module.exports.$filename = __filename;
```

IMPORTANT: If any of the arguments for the function are optional, you must given them a default value or an error will
be thrown when they fail to be injected.
```js
module.exports = function shortcutFactory(dependency1, dependency2, optionalDependency = null) {
  if (optionalDependency) {
    console.log('Dependency was found.');
  }
  return {
    doSomething: dependency1.doSomething,
    doSomethingElse: dependency2.doSomething
  };
};

module.exports.$inject = true;
module.exports.$filename = __filename;
```

Resolve arg that are optional will be defined in the $placeholders array using '?'
(see the 'Optional Arguments' section below).
```js
module.exports = function shortcutFactory(dependency1, dependency2, isGreen) {
  console.log('isGreen', isGreen);
  return {
    doSomething: dependency1.doSomething,
    doSomethingElse: dependency2.doSomething
  };
};

module.exports.$inject = true;
module.exports.$placeholders = ['isGreen?'];
module.exports.$filename = __filename;
```

Singletons/Caching
------------------
The results of factories can be cached/singleton in two ways.

1. Set $singleton on the factory.

```js
function testFactory() {
  return {
    some: 'value'
  };
}

testFactory.$singleton = true;
testFactory.$filename = __filename;

factoryDi.register('test', testFactory);

console.log(factoryDi.resolve('test') === factoryDi.resolve('test')); // Logs true.
```

2. Send the option `{forceSingleton: true}` when registering the factory. This will override anything set using $singleton.

```js
function testFactory() {
  return {
    some: 'value'
  };
}

testFactory.$singleton = false;
testFactory.$filename = __filename;

// Here we override the $singleton property by sending true for the 3rd arg.
factoryDi.register('test', testFactory, {forceSingleton: true});

console.log(factoryDi.resolve('test') === factoryDi.resolve('test')); // Logs true.
```

Optional Arguments
------------------
It is possible to define that injected arguments and/or resolve arguments are optional. If these items are not found,
then `undefined` will be provided as their value.
(Since `undefined` is used, any optional values defined in the function params will still be populated).

Let's create a factory with an optional injected dependency.
```js
module.exports = function exampleFactory(dependency1, dependency2 = null) {
  return {
    doSomething: dependency1.doSomething,
    doSomethingElse: (dependency2) ? dependency2.doSomething : null
  };
};

module.exports.$filename = __filename;

// The `= null` in the argument definition is required to make dependency2 optional.
module.exports.$inject = true;
// --or--
// Use ? after the dependency name to indicate it is optional (The `= null` will not do this by itself!).
module.exports.$inject = ['dependency1', 'dependency2?'];
```

Now let's add an optional resolve argument.
(Side Note: Notice now the optional injected parameters don't have to be after the required ones).
```js
module.exports = function exampleFactory(dependency1 = null, dependency2, optionalResolved) {
  console.log('optional resolved', optionalResolved);
  return {
    doSomething: (dependency1) ? dependency1.doSomething : null,
    doSomethingElse: dependency2.doSomething(optionalResolved || 'default')
  };
};

module.exports.$filename = __filename;

// The ? in the $placeholders definition is required to make the resolved argument optional.
module.exports.$inject = true;
module.exports.$placeholders = ['optionalResolved?'];
// --or--
// Use `name*?` when defining the resolved argument name to make it optional.
module.exports.$inject = ['dependency1?', 'dependency2', 'optionalResolved*?'];
```

File Tracking
-------------
In order to improve debugging and error checking flows, the factoryDi can track where the injected files
come from as well as where they were injected into the system.  By default, the system will throw an error
or warning if this information is missing.
```js
function testFactory() {
  return {
    some: 'value'
  };
}

// Tells the FactoryDi the file where the testFactory exists.
testFactory.$filename = __filename;

// Tells the FactoryDi the file where testFactory was registered.
const previousSource = factoryDi.setRegisterSource(__filename);
factoryDi.register('test', testFactory);
```

### Turning Off Source Checks
Use the `skipTraceErrors` factoryDi option to turn off the error when no register source is defined and the
console log warning when no $filename is defined.
```js
const factoryDiFactory = require('factory-di');

const factoryDi = factoryDiFactory();

factoryDi.register('something', true, {skipTraceErrors: true}); // Will not throw errors or warnings.
```

### Register Source
When you define the registerSource (`factoryDi.setRegisterSource();`) the system will remember this source and apply
it to all following registrations. This value is not carried over if the factoryDi is cloned.

The `setRegisterSource` function returns the previous source, which allows you to temporarily change the source and then
change it back.
```js
const previousSource = factoryDi.setRegisterSource(__filename);
factoryDi.register('test', testFactory);
factoryDi.setRegisterSource(previousSource);
```

Alternatively, each `factoryDi.register()` call can be given the `registerSourceFile` option to specify this value
for just the current injected factory.
```js
factoryDi.register('test', testFactory, {
  registerSourceFile: __filename
});
```

If no register source is defined, the factoryDi will throw an error. This can be bypassed using the `skipTraceErrors`
factoryDi option.

### Register File Path
The path to the source file of a registered factory can be defined using the `$filename` property.
In NodeJs, you can use the `__filename` variable to easily set this value.
If this value is not set, a warning will be console logged unless the `skipTraceErrors` option is truthy on register().

Alternatively, each `factoryDi.register()` call can be given the `$filename` option to override/specify this value
for just the current injected factory.
```js
factoryDi.register('test', testFactory, {
  filename: '/path/to/testFactory/file'
});
```

When defining a static value instead of a factory, you can use the override option to prevent the error and have proper
error tracking.
```js
factoryDi.register('test', 'staticValue', {
  filename: '/path/to/where/static/value/is/defined'
});
```

### Stack Trace
When an anticipated factoryDi error occurs, the stack trace will be overridden with the injection/resolution
path instead of the code path.  In most cases, the code path was not helpful (just a lodash loop).

An example of the stack trace (with notes after the `//`s).
```
FactoryDI Resolve Error: The item 'asdf' has not been registered.
    at asdf (?) // The item that caused the error.
        registered in [?]
    at parent (/code/src/parent.js) // The item that requested the item.
        registered in [/code/src/index.js] // Where this item was registered (factoryDi.register()).
    at grandparent (/code/src/grandparent.js)
        registered in [/code/src/grandparent/index.js]
    at topLevel (/code/src/topLevel.js) // The item that was first resolved (factoryDi.resolve()).
        registered in [/code/src/topLevel/index.js]
```

#### More Documentation to Come