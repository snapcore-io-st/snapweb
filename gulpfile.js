var aliasify = require('aliasify');
var postcss = require('gulp-postcss');
var autoprefixer = require('autoprefixer-core');
var bemlinter = require('postcss-bem-linter');
var browserify = require('browserify');
var buffer = require('vinyl-buffer');
var concat = require('gulp-concat');
var csso = require('gulp-csso');
var del = require('del');
var gulp = require('gulp');
var gutil = require('gulp-util');
var jscs = require('gulp-jscs');
var jshint = require('gulp-jshint');
var sass = require('gulp-sass');
var env = require('gulp-env');
var sourcemaps = require('gulp-sourcemaps');
var source = require('vinyl-source-stream');
var uglify = require('gulp-uglify');
var watchify = require('watchify');
var insert = require("gulp-insert");
var fs = require("fs");

gulp.task('js:build', ['js:clean', 'js:lint'], function() {
  if (!process.env.NODE_ENV) {
    // Default to development build for various tools.
    env.set({
      NODE_ENV: 'development'
    });
  }
  return createBundler();
});

gulp.task('js:clean', function(cb) {
  del(['www/public/js'], cb);
});

function createBundler(watch) {
  var bundler = browserify('./www/src/js/index.js', {
    cache: {},
    packageCache: {}
  });
  bundler.transform('hbsfy');
  bundler.transform({global: true}, 'aliasify');
  bundler.transform('babelify', {presets: ["react-app"]});

  if (watch) {
    bundler = watchify(bundler);
    bundler.on('update', function() {
      bundleShared(bundler);
    });
    bundler.on('log', gutil.log);
  } else {
  }

  return bundleShared(bundler);
}

function bundleShared(bundler) {
  return bundler.bundle()
    .on('error', function(err) {
      gutil.log(gutil.colors.green('Browserify Error: ' + err));
      this.emit('end');
      process.exit(1);
    })
    .pipe(source('snapweb.js'))
      .pipe(buffer())
      .pipe(sourcemaps.init({loadMaps: true})) // loads map from browserify file
      .pipe(process.env.NODE_ENV === 'development'? gutil.noop() : uglify())
      .pipe(sourcemaps.write('./')) // writes .map file
    .pipe(gulp.dest('www/public/js/'));
}

gulp.task('js:lint', function() {
  return gulp.src(['www/src/js/**/*.js'])
    .pipe(jscs())
    .on('error', function(err) {
      gutil.log(gutil.colors.green(err));
      this.emit('end');
      process.exit(1);
    })
    .pipe(jshint());
});

// Styles
gulp.task('styles', ['styles:clean'], function() {
  var processors = [
    autoprefixer({browsers: ['last 1 version']}),
    bemlinter('bem')
  ];

  // Hacky way to put together webpack stuff & local scss
  var toolkitCss = fs.readFileSync("node_modules/snapweb-toolkit/lib/bundle.css", "utf8");

  return gulp.src([
    'www/src/css/styles.scss'
  ])
  .pipe(sass({
    includePaths: ['node_modules']
  }))
  .pipe(sourcemaps.init())
  .pipe(postcss(processors))
  .pipe(csso())
  .pipe(concat('styles.css'))
  .pipe(sourcemaps.write('./'))
  .pipe(gulp.dest('www/public/css'))
  .pipe(insert.append(toolkitCss))
  .pipe(gulp.dest('www/public/css'))
});

gulp.task('styles:clean', function(cb) {
  del(['www/public/css'], cb);
});

// Images

gulp.task('images', ['images:clean'], function() {
  gulp.src(['www/src/images/**/*'])
  .pipe(gulp.dest('www/public/images'));
});

gulp.task('images:clean', function(cb) {
  del(['www/public/images'], cb);
});

// Watch tasks
gulp.task('js:watch', function() {
  gulp.watch('www/src/js/**/*.js', createBundler(true));
});

gulp.task('images:watch', ['images'], function() {
  gulp.watch('www/src/images/**/*.{svg,png,jpg,jpeg}', ['images']);
});

gulp.task('styles:watch', ['styles'], function() {
  gulp.watch('www/src/css/**/**/*.scss', ['styles']);
});

gulp.task('handlebars:watch', function() {
  gulp.watch('www/src/js/**/*.hbs', ['js:build']);
});

gulp.task('watch', ['handlebars:watch', 'js:watch', 'styles:watch', 'images:watch']);

// for the benefit of snapcraft
gulp.task('install', ['default'], function() {
  gulp.src(['www/public/**/*', 'www/templates/*'], { base: '.' })
    .pipe(gulp.dest('../install'));
});

gulp.task('default', ['js:build', 'styles', 'images']);
