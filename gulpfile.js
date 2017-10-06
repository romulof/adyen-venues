const gulp = require("gulp");
const sass = require("gulp-sass");
const sourcemaps = require('gulp-sourcemaps');
const postcss = require("gulp-postcss");
const autoprefixer = require("autoprefixer");
const flexibility = require('postcss-flexibility');
const cssnano = require("cssnano");
const pump = require('pump');
const browserSync = require("browser-sync").create();
const browserList = require("./package.json").browserlist;


const destDir = "./docs"; // Defined by github pages

// HTML ------------------------------------------------------------------------
// - copy from src to dest dir
const htmlTask = "html";
const htmlSrc = "./src/*.html";
gulp.task(htmlTask, () => pump([
  gulp.src(htmlSrc),
  gulp.dest(destDir),
  browserSync.stream(),
]));

// Assets ----------------------------------------------------------------------
// - copy from src to dest dir
const assetsTask = "assets";
const assetsSrc = "./assets/**/*";
gulp.task(assetsTask, () => pump([
  gulp.src(assetsSrc),
  gulp.dest(destDir),
  browserSync.stream(),
]));

// Scripts ---------------------------------------------------------------------
// - copy from src to dest dir
const scriptsTask = "scripts";
const scriptsSrc = "./src/scripts/**/*.js";
gulp.task(scriptsTask, () => pump([
  gulp.src(scriptsSrc),
  gulp.dest(destDir),
  browserSync.stream(),
]));

// Stylesheets -----------------------------------------------------------------
// - Compile SASS to CSS
// - Apply Autoprefixer using browser list definition from package.json
// - Minify output
// - Generate sourcemap
const stylesTask = "styles";
const stylesSrc = "./src/styles/**/*.scss"
gulp.task(stylesTask, () => pump([
  gulp.src(stylesSrc),
  sourcemaps.init(),
  sass().on('error', sass.logError),
  postcss([
    autoprefixer({ browsers: browserList }),
    flexibility,
    cssnano(),
  ]),
  sourcemaps.write("."),
  gulp.dest(destDir),
  browserSync.stream({ match: '**/*.css' }),
]));

// Default task with all procedures --------------------------------------------
gulp.task("default", [htmlTask, assetsTask, scriptsTask, stylesTask]);

// Development helper task -----------------------------------------------------
gulp.task("watch", ['default'], () => {
  browserSync.init({
    server: destDir,
    https: true,
    // snippetOptions: {
    //   rule: {
    //     match: /qqqqqqqqq/
    //   }
    // },
  });

  gulp.watch(htmlSrc, [htmlTask]);
  gulp.watch(scriptsSrc, [scriptsTask]);
  gulp.watch(stylesSrc, [stylesTask]);
  gulp.watch(assetsSrc, [assetsTask]);
});
