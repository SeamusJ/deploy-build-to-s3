var assert = require('assert');
var AWS = require('aws-sdk');
var http = require('http');
var unzip = require('unzip');

//Log something
function log(msg, obj) {
    console.log(msg, JSON.stringify(obj, null, 2));
}

// Notify AWS CodePipeline of a successful job
function putJobSuccess(job, context, message) {
    var codepipeline = new AWS.CodePipeline();
    
    var params = {
        jobId: job.id
    };
    codepipeline.putJobSuccessResult(params, function(err, data) {
        if(err) {
            context.fail(err);      
        } else {
            context.succeed(message);      
        }
    });
}

// Notify AWS CodePipeline of a failed job
function putJobFailure(job, context, message) {
    var codepipeline = new AWS.CodePipeline();

    var params = {
        jobId: job.id,
        failureDetails: {
            message: JSON.stringify(message),
            type: 'JobFailed',
            externalExecutionId: context.invokeid
        }
    };
    codepipeline.putJobFailureResult(params, function(err, data) {
        context.fail(message);      
    });
}

function uploadStreamToS3(s3, bucketName, fileName, stream) {
    var data = "";

    stream.on("data", function(chunk) {
        data += chunk;
    })
        .on("end", function() {
            var params = {
                Body: data,
                Bucket: bucketName,
                Key: fileName,
                ContentType: getContentTypeForFile(fileName),
                ACL: "public-read"
            };

            s3.putObject(params, function(err) {
                if(err){
                    log("Error uploading to s3:", err);
                    putJobFailure(job, context, "Error uploading to s3");
                    callback("Error uploading to s3");
                }
            });
        });
}

function getFileExtension(fileName) {
    return fileName.substr(fileName.lastIndexOf('.') + 1);
}

function getContentTypeForFile(fileName) {
    switch (getFileExtension(fileName)) {
        case "html":
        case "htm":
            return "text/html";
        case "js":
            return "application/x-javascript";
        case "css":
            return "text/css";
        default:
            return "text/" + getFileExtension(fileName);
    }
}

function stripLeadingPathChars(fileName){
    if(fileName.substr(0, 2) === "./"){
        return fileName.substr(2);
    }

    return fileName;
}

exports.handler = function(event, context, callback) {
    // Retrieve the Job ID from the Lambda action
    var job = event["CodePipeline.job"];
    var artifactCredentials = job.data.artifactCredentials;
    var inputArtifacts = job.data.inputArtifacts;
    var bucketName = job.data.actionConfiguration.configuration.UserParameters;

    var s3 = new AWS.S3({
        apiVersion: '2006-03-01',
        accessKeyId: artifactCredentials.accessKeyId,
        secretAccessKey: artifactCredentials.secretAccessKey,
        sessionToken: artifactCredentials.sessionToken,
        signatureVersion: "v4"
    });

    var params = {
        Bucket: inputArtifacts[0].location.s3Location.bucketName,
        Key: inputArtifacts[0].location.s3Location.objectKey
    }

    var req = s3.getObject(params).createReadStream();

    req.on("error", function(err){
        log("ERROR:", err);
        putJobFailure(job, context, "Error getting build artifacts.");
        callback(err);
    });
    
    s3 = new AWS.S3({ apiVersion: '2006-03-01' });

    req.pipe(unzip.Parse())
        .on("entry", function(entry) {
            log("Uploading file: ", entry.path);
            uploadStreamToS3(s3, bucketName, stripLeadingPathChars(entry.path), entry);
        })
        .on("close", function() {
            putJobSuccess(job, context, "Finished.");
            callback(null, "Finished.");
        })
        .on("error", function(err){
            putJobFailure(job, context, "Error uploading files to s3.");
        });
};