import * as AWS from "aws-sdk";
import * as unzip from "unzip";
import * as stream from "stream";
import { JobHandler } from "./job.handler";
import { Website } from "./website";

interface ICallbackFn {
    (err: AWS.AWSError | null, message?: string): void;
}

class EventHandler {
    private jobHandler: JobHandler;
    private website: Website;
    private inputArtifacts: IInputArtifacts[];
    private s3: AWS.S3;

    constructor(private event: IEvent, private context: IContext, private callback: ICallbackFn) {
        let job = event["CodePipeline.job"];

        this.s3 = this.createS3Client(job);
        this.jobHandler = new JobHandler(job, context);
        this.inputArtifacts = job.data.inputArtifacts;
        this.website = this.createWebsite(job)
    }

    handleEvent() {
        let inputStream = this.getReadableStreamForInputArtifact();

        this.handleStreamReadErrors(inputStream);

        this.unzipInputArtifactAndUploadFilesToWebsite(inputStream);
    };

    private getReadableStreamForInputArtifact(): stream.Readable {
        let params = {
            Bucket: this.inputArtifacts[0].location.s3Location.bucketName,
            Key: this.inputArtifacts[0].location.s3Location.objectKey
        };

        return this.s3.getObject(params).createReadStream();
    }

    private unzipInputArtifactAndUploadFilesToWebsite(inputStream: stream.Readable): void {
        inputStream.pipe(unzip.Parse())
            .on("entry", (entry: any) => {
                let fileName = this.stripLeadingPathChars(entry.path);

                this.website.uploadFileFromStream(fileName, entry);
            })
            .on("close", () => {
                this.jobHandler.putJobSuccess("Finished.");
                this.callback(null, "Finished.");
            })
            .on("error", (err: any) => {
                this.failJob("Error uploading files to s3.", err);
            });
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

    private createWebsite(job: IJob): Website {
        let bucketName = job.data.actionConfiguration.configuration.UserParameters;

        return new Website(job.data.actionConfiguration.configuration.UserParameters, (message, err) => {
            this.failJob(message, err);
        });
    }

    private failJob(message: string, err: any): void {
        this.log("ERROR:", err);
        this.jobHandler.putJobFailure("Error getting build artifacts.");
        this.callback(err);
    }

    private log(msg: string, obj: object): void {
        console.log(msg, JSON.stringify(obj, null, 2));
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