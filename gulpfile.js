let gulp = require("gulp");
let zip = require("gulp-zip");

let sourceFiles = [
    "./**/*",
    "!./*.ts",
    "!./*.json",
    "!./*.zip",
    "!./gulpfile.js",
    "!./.gitignore"
];

gulp.task("build:zip", () => {
    gulp.src(sourceFiles, { dot: true, base: "./" })
        .pipe(zip("deploy-build-to-s3.zip"))
        .pipe(gulp.dest("./"));
});