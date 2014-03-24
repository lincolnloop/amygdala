'use strict';

var _ = require('lodash');
var browserify = require('gulp-browserify');
var gulp = require('gulp');
var gutil = require('gulp-util');
var pkg = require('./package.json');
var rename = require('gulp-rename');
var wrap = require('gulp-wrap');

gulp.task('dist', function() {
  // Set the environment to production
  process.env.NODE_ENV = 'production';
  return gulp.start('build');
});

gulp.task('build', function() {
  var production = process.env.NODE_ENV === 'production';

  return gulp.src('./amygdala.js')

    // Browserify, and add source maps if this isn't a production build
    .pipe(browserify({debug: !production}))

    .on('prebundle', function(bundler) {
      if (production) {
        // Externalize dependencies so they aren't included in the build
        bundler.external('underscore');
        bundler.external('backbone');
        bundler.external('loglevel');

        // Export Amygdala as 'amygdala'
        bundler.require('./amygdala.js', {expose: 'amygdala'});
      }
    })

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
