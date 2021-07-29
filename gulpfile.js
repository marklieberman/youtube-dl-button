'use strict';

var gulp   = require('gulp'),
    eslint = require('gulp-eslint'),
    sass   = require('gulp-sass'),
    zip    = require('gulp-zip');

var sources = {
  js: [
    'src/**/*.js'
  ],
  sass: [
    'src/common/bootstrap.scss',
    'src/popup/popup.scss'
  ],
  watch: {
    sass: [
      'src/**/*.scss'
    ]
  },
  dist: [
    'src/**'
  ]
};

function watchFiles () {
  gulp.watch(sources.js, lintTask);
  
  // Other sass files import these, so build them when these change.
  gulp.watch(sources.watch.sass, sassTask);
}

function sassTask () {
  return gulp.src(sources.sass)
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest(function (file) {
      return file.base;
    }));
}

function lintTask () {
  return gulp.src(sources.js)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
}

function distTask () {
  return gulp.src(sources.dist)
    .pipe(zip('youtube-dl-button.xpi', {
      compress: false
    }))
    .pipe(gulp.dest('dist'));
}

exports.sass = sassTask;
exports.lint = lintTask;
exports.dist = distTask;

exports.watch = gulp.series(sassTask, watchFiles);
exports.default = gulp.series(lintTask, watchFiles);