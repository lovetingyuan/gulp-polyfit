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

var defaultConfig = {
  output: './', // output dir, default: './'
  minify: true, // default: true
  features: [], // extra polyfills, will prepend to the result
  filename: 'polyfill.min.js', // the polyfill file name, default: polyfill.min.js
  result: 'polyfill_list.json'
}

var headers = {
  // polyfill.io minimum support IE7
  'user-agent': 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)'
}

function getAllScripts(fileList, cb) {
  var self = this;
  var index = 0
  fileList.forEach(function(polyfill) {
    https.get({
      protocol: 'https:',
      hostname: 'cdn.polyfill.io',
      path: polyfill.urlPath,
      timeout: 20000,
      headers: headers
    }, function(res) {
      res.setEncoding('utf8');
      if (res.statusCode !== 200) {
        res.resume();
        return cb(new PluginError(PLUGIN_NAME,
          'Fail to get polyfills with http code ' + res.statusCode))
      }
      self.push(new Vinyl({
        path: polyfill.filePath,
        contents: res
      }))
      index++
      if(index === fileList.length) cb()
    }).on('error', cb);
  })

}

module.exports = function(config) {
  if (!config || typeof config !== 'object') {
    config = defaultConfig
  } else {
    if (!('minify' in config)) {
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
  }, function(callback) {
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

    config.result && this.push(new Vinyl({
      path: path.resolve(output, config.result),
      contents: new Buffer(JSON.stringify({
        polyfills: features.slice()
      }, null, 2))
    }))

    var polyfills =  features.concat(features.join(',')).map(function(feature, i) {
      var params = [];
      params.push('features=' + feature)
      params.push('flags=always')
      var urlPath = '/v2/polyfill' +
        (config.minify ? '.min' : '') + '.js?' + params.join('&')
      var fileName = (i === features.length) ? config.filename : (feature + '.js')
      return {
        urlPath: urlPath,
        filePath: path.resolve(output, fileName)
      }
    })

    getAllScripts.call(this, polyfills, callback)

  });
};
