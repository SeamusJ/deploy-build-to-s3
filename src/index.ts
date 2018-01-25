import * as AWS from "aws-sdk";
import * as unzip from "unzip-stream";
import * as stream from "stream";
import { JobHandler } from "./job.handler";
import { Website } from "./website";

interface ICallbackFn {
    (err: AWS.AWSError | null, message?: string): void;
}

class UserParameters {
    targetS3Bucket: string;
    cleanAbsentFiles: boolean;
    ignoreFiles: string[];
    keyPrefix: string;
}

class EventHandler {
    private userParameters: UserParameters;
    private jobHandler: JobHandler;
    private website: Website;
    private inputArtifacts: IInputArtifacts[];
    private s3: AWS.S3;

    constructor(private event: IEvent, private context: IContext, private callback: ICallbackFn) {
        let job = event["CodePipeline.job"];

        this.s3 = this.createS3Client(job);
        this.jobHandler = new JobHandler(job, context);
        this.inputArtifacts = job.data.inputArtifacts;
        this.userParameters = this.parseUserParameters(job);
        this.website = this.createWebsite()
    }

    async handleEvent() {
        let inputStream = this.getReadableStreamForInputArtifact();
        this.handleStreamReadErrors(inputStream);
        let deployedFiles = await this.unzipInputArtifactAndUploadFilesToWebsite(inputStream);
        this.log("Deployed " + deployedFiles.length + " files.");
        if (deployedFiles.length === 0) {
            return; // Something's wrong; we'll rely on lower functions to report to Lambda
        }

        let cleanupHadErrors = false;
        if (this.userParameters.cleanAbsentFiles) {
            this.log("Scrubbing old files, except for ignored list: ", this.userParameters.ignoreFiles);
            cleanupHadErrors = await this.removeAbsentFilesFromWebsite(deployedFiles, this.userParameters.ignoreFiles);
        }
        if (cleanupHadErrors) {
            return; // Something's wrong, we'll rely on the lower functions to report it to Lambda
        }

        this.jobHandler.putJobSuccess("Finished.");
        this.callback(null, "Finished.");
    };

    private getReadableStreamForInputArtifact(): stream.Readable {
        let params = {
            Bucket: this.inputArtifacts[0].location.s3Location.bucketName,
            Key: this.inputArtifacts[0].location.s3Location.objectKey
        };

        return this.s3.getObject(params).createReadStream();
    }

    private async unzipInputArtifactAndUploadFilesToWebsite(inputStream: stream.Readable): Promise<string[]> {
        let unzipPromise = new Promise<string[]>((resolve, reject) => {
            let files: string[] = [];

            inputStream.pipe(unzip.Parse())
                .on("entry", (entry: any) => {
                    let fileName = this.stripLeadingPathChars(entry.path);

                    if (this.userParameters.keyPrefix)
                      fileName = this.userParameters.keyPrefix + fileName;

                    this.website.uploadFileFromStream(fileName, entry);
                    files.push(fileName);
                })
                .on("close", () => {
                    resolve(files);
                })
                .on("error", (err: any) => {
                    this.failJob("Error uploading files to s3.", err);
                    reject(err);
                });
        });

        return await unzipPromise;
    }

    private async removeAbsentFilesFromWebsite(deployedFiles: string[], ignoreFiles: string[]) : Promise<boolean> {
        let errors = await this.website.removeDifferences(deployedFiles.concat(ignoreFiles));

        if (errors.length > 0) {
            errors.forEach(error => {
                this.log("ERROR: problem cleaning up excess file", error);
            });
            this.failJob("Failing job due to failure to cleanup excess files", errors[0]);
            return true;
        } else {
            return false;
        }
    }

    private handleStreamReadErrors(inputStream: stream.Readable): void {
        inputStream.on("error", (err) => {
            this.failJob("Error getting build artifacts.", err);
        });
    }

    private createS3Client(job: IJob): AWS.S3 {
        let artifactCredentials = job.data.artifactCredentials;

        return new AWS.S3({
            apiVersion: '2006-03-01',
            accessKeyId: artifactCredentials.accessKeyId,
            secretAccessKey: artifactCredentials.secretAccessKey,
            sessionToken: artifactCredentials.sessionToken,
            signatureVersion: "v4"
        });
    }

    private createWebsite(): Website {
        return new Website(this.userParameters.targetS3Bucket, (message, err) => {
            this.failJob(message, err);
        });
    }

    private parseUserParameters(job: IJob) {
        let paramString = job.data.actionConfiguration.configuration.UserParameters;
        let params = paramString.split(',');
        let userParameters = new UserParameters();
        userParameters.targetS3Bucket = params[0];
        if (params.length > 1) {
            userParameters.cleanAbsentFiles = (params[1] == 'true');
        }
        if (params.length > 2) {
            userParameters.ignoreFiles = params[2].split('|');
        }
        if (params.length > 3) {
        	userParameters.keyPrefix = params[3];
        }
        return userParameters;
    }

    private failJob(message: string, err: any): void {
        this.log("ERROR:", err);
        this.jobHandler.putJobFailure("Error getting build artifacts.");
        this.callback(err);
    }

    private log(msg: string, obj: object | null = null): void {
        if (obj) {
            console.log(msg, JSON.stringify(obj, null, 2));
        } else {
            console.log(msg);
        }
    }

    private stripLeadingPathChars(fileName: string): string {
        if(fileName.substr(0, 2) === "./"){
            return fileName.substr(2);
        }

        return fileName;
    }
}

export let handler = (event: IEvent, context: IContext, callback: ICallbackFn) => {
    let eventHandler = new EventHandler(event, context, callback);

    eventHandler.handleEvent();
}