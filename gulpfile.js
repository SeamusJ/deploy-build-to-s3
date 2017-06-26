let gulp = require("gulp");
let zip = require("gulp-zip");

let sourceFiles = [
    "./*.js",
    "node_modules/**/*.*"
];

gulp.task("build:zip", () => {
    gulp.src(sourceFiles)
        .pipe(zip("deploy-build-to-s3.zip"))
        .pipe(gulp.dest("./"));
});