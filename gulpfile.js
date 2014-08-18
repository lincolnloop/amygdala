'use strict';

var _ = require('lodash');
var browserify = require('gulp-browserify');
var gulp = require('gulp');
var pkg = require('./package.json');
var rename = require('gulp-rename');
var uglify = require('gulp-uglify');
var wrap = require('gulp-wrap');

gulp.task('default', function() {
  // Set the environment to production
  process.env.NODE_ENV = 'production';
  gulp.start('distribute');
});

gulp.task('build', function() {
  var production = process.env.NODE_ENV === 'production';

  var stream = gulp.src('./amygdala.js')

    // Browserify, and add source maps if this isn't a production build
    .pipe(browserify({debug: !production}))

    .on('prebundle', function(bundler) {
      if (production) {
        // Externalize dependencies so they aren't included in the build
        bundler.external('underscore');
        bundler.external('loglevel');
        bundler.external('q');
        bundler.external('event-emitter');

        // Export Amygdala as 'amygdala'
        bundler.require('./amygdala.js', {expose: 'amygdala'});
      }
    })

    // Rename the destination file
    .pipe(rename(pkg.name + '.js'));

  if (production) {
    // Wrap in a UMD template
    stream.pipe(wrap({src: 'templates/umd.jst'}, {
      pkg: pkg,
      namespace: 'Amygdala',
      deps: {
        'underscore': '_',
        'loglevel': 'loglevel',
        'q': 'Q',
        'event-emitter': 'EventEmitter'
      },
      expose: 'amygdala'
    }, {'imports': {'_': _}}));
  }

  // Dist directory if production, otherwise the ignored build dir
  stream.pipe(gulp.dest(production ? 'dist/' : 'build/'));

  return stream;
});

gulp.task('distribute', ['build'], function() {
  gulp.src('dist/' + pkg.name + '.js')
    .pipe(uglify())
    .pipe(rename(pkg.name + '.min.js'))
    .pipe(gulp.dest('dist/'));
});
