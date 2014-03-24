'use strict';

var _ = require('lodash');
var gulp = require('gulp');
var gutil = require('gulp-util');
var pkg = require('./package.json');
var wrap = require('gulp-wrap');
var rename = require('gulp-rename');

gulp.task('dist', function() {
  // Set the environment to production
  process.env.NODE_ENV = 'production';
  return gulp.start('build');
});

gulp.task('build', function() {
  var production = process.env.NODE_ENV === 'production';

  return gulp.src('./amygdala.js')

    // Rename the destination file
    .pipe(rename(pkg.name + '.js'))

    // Wrap in a UMD template if production
    .pipe(production ? wrap({src: 'templates/umd.jst'}, {
      pkg: pkg,
      namespace: 'Amygdala',
      deps: {
        'underscore': '_',
        'backbone': 'backbone',
        'loglevel': 'loglevel'
      },
      expose: 'amygdala'
    }, {'imports': {'_': _}}) : gutil.noop())

    // Dist directory if production, otherwise the ignored build dir
    .pipe(gulp.dest(production ? 'dist/' : 'build/'));
});
