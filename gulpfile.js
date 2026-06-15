import gulp from 'gulp';
import eslint from 'gulp-eslint-new';
import jsonTransform from 'gulp-json-transform';
import zip from 'gulp-zip';

// Initialize gulp-sass with Dart Sass.
import * as dartSass from 'sass';
import gulpSass from 'gulp-sass';

const sassCompiler = gulpSass(dartSass);

const sources = {
  js: [
    'src/**/*.js'
  ],
  sass: [
    'src/common/bootstrap.scss',
    'src/options/options.scss',
    'src/popup/popup.scss'
  ],
  watch: {
    sass: [
      'src/**/*.scss'
    ]
  },
  dist: [
    'src/**',    
    '.tmp/manifest.json',
    '!src/manifest.json'
  ]
};

export function watchFiles () {
  gulp.watch(sources.js, lintTask);
  
  // Other sass files import these, so build them when these change.
  gulp.watch(sources.watch.sass, sassTask);
}

export function sassTask () {
  return gulp.src(sources.sass)
    .pipe(sassCompiler().on('error', sassCompiler.logError))
    .pipe(gulp.dest(function (file) {
      return file.base;
    }));
}

export function lintTask () {
  return gulp.src(sources.js)
    .pipe(eslint())
    .pipe(eslint.format())
    .pipe(eslint.failAfterError());
}

export function manifestEdge () {
  return gulp
    .src('src/manifest.json')
    .pipe(jsonTransform(function (data, file) {
      delete data.background.scripts;
      return data;
    }, 4))
    .pipe(gulp.dest('.tmp'));
}

export function zipEdge () {
  return gulp
    .src(sources.dist, { encoding: false })
    .pipe(zip('youtube-dl-button-edge.zip', {
      compress: false
    }))
    .pipe(gulp.dest('dist'));
}

export function manifestFirefox () {
  return gulp
    .src('src/manifest.json')
    .pipe(jsonTransform(function (data, file) {
      return data;
    }, 4))
    .pipe(gulp.dest('.tmp'));
}

export function zipFirefox () {
  return gulp
    .src(sources.dist, { encoding: false })
    .pipe(zip('youtube-dl-button-firefox.zip', {
      compress: false
    }))
    .pipe(gulp.dest('dist'));
}

export const sass2 = sassTask;
export const lint = lintTask;

export const watch = gulp.series(
  sassTask, 
  watchFiles);
export const distEdge = gulp.series(
  lintTask, 
  sassTask, 
  manifestEdge, 
  zipEdge);
export const distFirefox = gulp.series(
  lintTask, 
  sassTask, 
  manifestFirefox, 
  zipFirefox);
export const dist = gulp.series(
  lintTask, 
  sassTask, 
  manifestEdge, 
  zipEdge,
  manifestFirefox, 
  zipFirefox);

export default gulp.series(
  lintTask, 
  watchFiles);