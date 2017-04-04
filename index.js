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
var step = require('ty-step')

var PLUGIN_NAME = 'gulp-polyfit';

var defaultConfig = {
  output: './', // output dir, default: './'
  minify: true, // default: true
  features: [], // extra polyfills, will prepend to the result
  filename: 'polyfill.min.js', // the polyfill file name, default: polyfill.min.js
  result: 'polyfill_list.json'
}

function getPolyfillScripts(urlPath, filePath) {
  var self = this
  return function(next) {
    https.get({
      protocol: 'https:',
      hostname: 'cdn.polyfill.io',
      path: urlPath,
      timeout: 20000,
      headers: {
        // polyfill.io minimum support IE7
        'user-agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)'
      }
    }, function(res) {
      res.setEncoding('utf8');
      if (res.statusCode !== 200) {
        res.resume();
        return next(new PluginError(PLUGIN_NAME,
          'Fail to get polyfills with http code ' + res.statusCode))
      }
      var payload = '';
      res.on('data', function(chunk) {
        payload += chunk
      }).on('end', function() {
        // payload = '// polyfills: ' + features.join(', ') + os.EOL + payload
        var file = new Vinyl({
          path: filePath,
          contents: new Buffer(payload)
        })
        self.push(file)
        next(null, file)

      });
    }).on('error', next);
  }
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
    if (typeof config.output !== 'string') {
      config.output = defaultConfig.output
    }
  }
  var polyfillList = []

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
    callback()

    // callback(null, file)
  }, function(callback) {
    var self = this
    var output = config.output
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

    config.result && self.push(new Vinyl({
      path: path.resolve(output, config.result),
      contents: new Buffer(JSON.stringify({
        polyfills: features.slice()
      }, null, 2))
    }))

    features.push(features.join(','))
    step.call(null, features.map(function(feature, i) {
      var params = [];
      params.push('features=' + feature)
      params.push('flags=always')
      var urlPath = '/v2/polyfill' +
        (config.minify ? '.min' : '') + '.js?' + params.join('&')
      var fileName = (i === features.length - 1) ? config.filename : (feature + '.js')
      return getPolyfillScripts.call(self, urlPath, path.resolve(output, fileName))
    }))(function(err, list) {
      if (err) {
        gutil.log(PLUGIN_NAME + ' needs a network connection and check your polyfill name')
        gutil.log(PLUGIN_NAME, err)
        return callback(err)
      }
      callback()
    })
  });
};
