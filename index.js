// tingyuan 2017.3.31 v1.0.0
//
var path = require('path')
var https = require('https')
var os = require('os')

var gutil = require('gulp-util')
var PluginError = gutil.PluginError;
var Vinyl = gutil.File;
var through = require('through2');
var acorn = require('acorn')

var PLUGIN_NAME = 'gulp-polyfit';
var polyfillList = []

var defaultConfig = {
  minify: true, // default: true
  features: [], // extra polyfills, will prepend to the result
  filename: 'polyfill.min.js', // the polyfill file name, default: polyfill.min.js
  result: 'polyfill_list.json'
}

module.exports = function(config) {
  if (!config || typeof config !== 'object') {
    config = defaultConfig
  } else {
    if ('minify' in config) {
      config.minify = !!config.minify
    } else {
      config.minify = defaultConfig.minify
    }
    if (!(config.features instanceof Array)) {
      config.features = defaultConfig.features.slice()
    }
    if (typeof config.filename !== 'string') {
      config.filename = defaultConfig.filename
    }

    if (typeof config.result !== 'string') {
      config.result = false
    }
  }

  return through.obj(function(file, encoding, callback) {
    if (file.isNull()) {
      return callback(null, file);
    }
    if (file.isStream()) {
      return callback(new PluginError(PLUGIN_NAME, 'Streams not supported!'))
    }
    var content = file.contents.toString(encoding)
    var comments = []
    try {
      acorn.parse(content, {
        onComment: comments
      })
    } catch (e) {
      return callback(new PluginError(PLUGIN_NAME,
        'your javascript files contain syntax errors'))
    }
    comments.forEach(function(commentNode) {
      var comment = commentNode.value.replace(/[\s|\*]/g, '')
      var polyfills
      if (/^polyfill:/.test(comment)) {
        polyfills = comment.substr(comment.indexOf(':') + 1).split(',')
        polyfills.length && polyfillList.push(polyfills)
      }
    })

    callback(null, file)
  }, function(callback) {
    var params = []
    var getPolyfills = function(result) {
      var polyfills = {}
      result.reduce(function(p, c) {
        return p.concat(c)
      }).forEach(function(polyfill) {
        polyfills[polyfill] = true
      })
      return Object.keys(polyfills).sort()
    }

    var features = config.features.concat(getPolyfills(polyfillList))
    if (!features.length) {
      return callback()
    }
    config.result && this.push(new Vinyl({
      path: path.resolve(config.result),
      contents: new Buffer(JSON.stringify({
        polyfills: features
      }, null, 2))
    }))

    params.push('features=' + features.join(','))
    params.push('flags=always')

    https.get({
      protocol: 'https:',
      hostname: 'polyfill.io',
      path: '/v2/polyfill' + (config.minify ? '.min' : '') + '.js?' + params.join('&'),
      timeout: 20000,
      headers: {
        // polyfill.io minimum support IE7
        'user-agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)'
      }
    }, function(res) {
      res.setEncoding('utf8');
      if (res.statusCode !== 200) {
        res.resume();
        gutil.log(PLUGIN_NAME + ' needs a network connection')
        return callback(new PluginError(PLUGIN_NAME,
          'Fail to get polyfills with http code ' + res.statusCode))
      }
      var payload = '';
      res.on('data', function(chunk) {
        payload += chunk
      }).on('end', function() {
        payload = '// polyfills: ' + features.join(', ') + os.EOL + payload
        callback(null, new Vinyl({
          path: path.resolve(config.filename),
          contents: new Buffer(payload)
        }))
        this.emit('end')
      });
    }).on('error', function(e) {
      gutil.log(PLUGIN_NAME + ' needs a network connection')
      callback(e)
    });
  });
};
