let gulp = require("gulp");
let install = require("gulp-install");
let zip = require("gulp-zip");

let sourceFiles = [
    "./**/*",
    "!./*.ts",
    "!./*.json",
    "!./*.zip",
    "!./gulpfile.js",
    "!./.gitignore"
];

gulp.task('install',function(){
    gulp.src('./package.json')
    .pipe(gulp.dest('./dist'))
    .pipe(install({production : true}))
});

gulp.task("build:zip", () => {
    gulp.src(['dist/**/*'], { nodir: true })
        .pipe(zip("deploy-build-to-s3.zip"))
        .pipe(gulp.dest("./"));
});