var assert = require('assert');
var es = require('event-stream');
var File = require('gulp-util').File;
var polyfit = require('../');
var path = require('path')

describe('gulp-polyfit', function() {
  describe('in buffer mode', function() {

    it('should output polyfills json file', function(done) {
      function testFunction(a, b) {
        /**
        * polyfill: Function.prototype.bind, Object.assign,
        * Date.now, Promise, fetch
        */
        // as the src file
        return a + b; // polyfill: Array.prototype.map, String.prototype.trim
      }
      var result = JSON.stringify({
        polyfills: [
          'Array.prototype.map',
          'Date.now',
          'Function.prototype.bind',
          'Object.assign',
          'Promise',
          'String.prototype.trim',
          'fetch'
        ]
      }, null, 2)

      // create the fake file
      var fakeFile = new File({
        contents: new Buffer(testFunction.toString())
      });

      // Create a prefixer plugin stream
      var polyfitStream = polyfit({
        result: 'polyfills.json'
      });

      // wait for the file to come back out
      polyfitStream.on('data', function(file) {
        // make sure it came out the same way it went in
        console.log(file.contents.toString())
        assert(file.isBuffer());

        // check the contents
        if(file.path === path.resolve('polyfills.json')) {
          assert.equal(file.contents.toString('utf8'), result);
        }
      });

      polyfitStream.write(fakeFile);
      polyfitStream.end(done)

    });

  });
});