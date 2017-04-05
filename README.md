# gulp-polyfit
Generate the polyfill file by collecting the polyfill marks in the comment, thanks to https://polyfill.io

### install
`npm install gulp-polyfit --save-dev`

### usage
```javascript
var gulp = require('gulp')
var polyfit = require('gulp-polyfit')
gulp.task('polyfill', function() {
  return gulp.src('test.js')
    .pipe(polyfit({
      output: './', // output dir, default: './'
      minify: true, // default: true, minify the polyfill script
      features: [], // extra polyfill features
      filename: 'polyfill.min.js', // the polyfill file name, default: polyfill.min.js
      result: 'polyfill_list.json' // if specified, will output all the polyfills name
    }))
    .pipe(gulp.dest('./'))
})
```
test.js:
```javascript
/**
 * polyfill: Array.from,
 *     Number.parseInt, Number.isInteger
 */
function addInt() {
  var args = Array.from(arguments)
  // polyfill: Array.prototype.map, Array.prototype.filter
  return args.map(function(value) {
    return Number.parseInt(value, 10)
  }).filter(function(value) {
    return Number.isInteger(value)
  }).reduce(function(foo, bar) { // polyfill: Array.prototype.reduce
    return foo + bar
  })
}
console.log(addInt(1, 2, 3)) // result is 6
```

run `gulp polyfill`, and the polyfill_list.json will be:

```json
{
  "polyfills": [
    "Array.from",
    "Array.prototype.filter",
    "Array.prototype.map",
    "Array.prototype.reduce",
    "Number.isInteger",
    "Number.parseInt"
  ]
}
```

**the polyfill comment must start with `"polyfill:"` and separate the features by commas**

you can find all support features at https://polyfill.io/v2/docs/features/,

you can use `(LABjs)['https://github.com/getify/LABjs']` or `(yepnope.js)['https://github.com/SlexAxton/yepnope.js']` to load polyfills conditionally,

