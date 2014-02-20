var Container = require('../lib/container');
var assert = require('chai').assert;
var Promise = require('bluebird');

Promise.onPossiblyUnhandledRejection(function(error){
  // ignore promises which don't handle errors
});

suite('container', function() {
  setup(function() {
    this.container = new Container();
  });

  teardown(function() {
    this.container = null;
  });

  suite('register throws error', function() {

    test('with no arguments', function() {
      var container = this.container;
      assert.throw(function() {
        container.register({});
      }, /must have a name/i);
    });

    test('with no function', function() {
      var container = this.container;
      assert.throw(function() {
        container.register('foo');
      }, /must give a function/i);
    });

    test('already registered', function() {
      var container = new Container();
      container.register('first', function() {});
      assert.throw(function() {
        container.register('first', function() {});
      }, /already registered/i);
    });


  });

  suite('register/resolve', function() {

    test('`resolve` throws error if module is not registered', function(done) {
      var container = this.container;
      Promise.spawn(function* () {
        try {
          yield container.resolve('doesntExist');
          done(new Error('resolve should throw an error'));
        } catch(err) {
          if(/no module (:?.*?) registered/i.test(err.toString())) {
            done();
          } else {
            done(err);
          }
        }
      }).catch(done);
    });

    test('module with no dependencies', function(done) {
      var container = this.container;
      Promise.spawn(function* () {
        container.register('noDep', function() { return 'nodep'; });
        var result = yield container.resolve('noDep');
        assert.equal(result, 'nodep');
        done();
      }).catch(done);
    });

    test('module with a dependency', function(done) {
      var container = this.container;

      var o1 = function() { return 'o1'; }
      var o2 = function(o1) { return o1+' augmented'; }

      Promise.spawn(function* () {
        container.register('o1', o1);
        container.register('o2', o2);
        var o2Module = yield container.resolve('o2');
        assert.equal(o2Module, 'o1 augmented');
        done();
      }).catch(done);
    });

    test('module with an explicit dependency', function(done) {
      var container = this.container;

      var o1 = function() { return 'o1'; }
      var o2 = function(foo) { return foo+' augmented'; }

      Promise.spawn(function* () {
        container.register('o1', o1);
        container.register('o2', ['o1', o2]);
        var o2Module = yield container.resolve('o2');
        assert.equal(o2Module, 'o1 augmented');
        done();
      }).catch(done);
    });

    test('throw error when dependency is not found', function(done) {
      var container = this.container;
      container.register('willFail', function(notHere) {return 'ok'; });
      Promise.spawn(function* () {
        try {
          yield container.resolve('willFail');
          done(new Error('resolve should throw an error'));
        } catch(err) {
          if(/dependency not found/i.test(err.toString())) {
            done();
          } else {
            done(err);
          }
        }
      }).catch(done);
    });


  });

  test('can register existing objects', function() {
    var container = this.container;

    var fs = require('fs');
    assert.equal(container.registerAndExport('fs', fs), fs);
  });

  suite('circular dependencies', function() {

    test('false positive', function(done) {
      var container = this.container;
      Promise.spawn(function* () {
        container.registerAndExport('a', 'a');
        container.register('b', function(a) {
          return a+'b';
        });
        container.register('c', function(a, b) {
          return a+b+'c';
        });
        yield container.resolve('c');
        done();
      }).catch(done);
    });

    test('throw error', function(done) {
      var container = this.container;
      Promise.spawn(function* () {
        // a -> b -> c -> a
        container.register('a', function(c) { return c+'a'; });
        container.register('b', function(a) { return a+'b'; });
        container.register('c', function(b) { return b+'c'; });

        yield container.resolve('a');
        done(new Error('Should throw an error'));
      }).catch(function(err) {
        if(/circular dependency/i.test(String(err))) {
          done();
        } else {
          done(err);
        }
      });
    });

  });

});
