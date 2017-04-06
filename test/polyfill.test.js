var assert = require('assert');
var File = require('gulp-util').File;
var polyfit = require('../');
var path = require('path')

describe('gulp-polyfit', function() {
  describe('in buffer mode', function() {

    it('should output polyfills json file', function(done) {
      function testFunction(a, b) {
        /**
         * polyfill: Function.prototype.bind, Promise,
         * fetch, Date.now, Object.assign
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
        assert(file.isBuffer());
        // check the contents
        assert.equal(file.contents.toString('utf8'), result);
        assert.equal(file.path, path.resolve(__dirname, '../polyfills.json'));

        // done()
      });

      polyfitStream.write(fakeFile);
      polyfitStream.end(done)
    });

  });
});
