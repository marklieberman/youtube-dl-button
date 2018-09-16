'use strict';

var gulp     = require('gulp'),
    jshint   = require('gulp-jshint'),
    sass     = require('gulp-sass'),
    zip      = require('gulp-zip');

var sources = {
  js: [
    'src/**/*.js'
  ],
  sass: [
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

gulp.task('default', [ 'lint', 'watch' ]);

gulp.task('watch', function () {
  gulp.watch(sources.js, [ 'lint' ]);
  gulp.watch(sources.watch.sass, [ 'sass' ]);
});

gulp.task('sass', function () {
  gulp.src(sources.sass)
    .pipe(sass().on('error', sass.logError))
    .pipe(gulp.dest(function (file) {
      return file.base;
    }));
});

gulp.task('lint', function () {
  return gulp.src(sources.js)
    .pipe(jshint())
    .pipe(jshint.reporter('jshint-stylish'));
});

gulp.task('dist', [ 'sass', 'lint' ], function () {
  return gulp.src(sources.dist)
    .pipe(zip('youtube-dl-button.xpi', {
      compress: false
    }))
    .pipe(gulp.dest('dist'));
});
