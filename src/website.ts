import * as AWS from "aws-sdk";
import * as mimeTypes from "mime-types";

export interface IErrorHandler {
    (message: string, err: object): void;
}

export class Website {
    private s3: AWS.S3;

    constructor(private bucketName: string, private keyPrefix: string, private onError: IErrorHandler) {
        this.s3 = new AWS.S3({ apiVersion: '2006-03-01' });
    }

    uploadFileFromStream(fileName: string, stream: any) {
        var data: any[] = [];

        stream
            .on("data", (chunk: string) => {
                data.push(chunk);
            })
            .on("end", () => {
                let params : any = {
                    Body: Buffer.concat(data),
                    Bucket: this.bucketName,
                    Key: fileName,
                    ACL: "public-read"
                };
                const contentType = mimeTypes.lookup(fileName);
                if (contentType) {
                    params.ContentType = contentType;
                }

                this.s3.putObject(params, (err: object) => {
                    if(err){
                        this.onError("Error uploading file to s3 bucket", err);
                    }
                });
            });
    }

    async removeDifferences(keepFiles: string[]) : Promise<AWS.S3.Error[]> {
        let existingFiles = await this.getAWSBucketListing();

        let filesToRemove = existingFiles.filter((item) => { return ! (keepFiles.indexOf(item) > -1); });

        if (filesToRemove.length !== 0) {
            console.log("Deleting old files: " + JSON.stringify(filesToRemove));
            let params = {
                Bucket: this.bucketName,
                Delete: {
                    Objects: filesToRemove.map((item) => ({ Key: item }))
                }
            };
            let result = await this.s3.deleteObjects(params).promise();
            return result.Errors || [];
        }
        return [];
    }

    private async getAWSBucketListing(): Promise<string[]> {
        let params: any = { Bucket: this.bucketName, Prefix: this.keyPrefix };
        let files: string[] = [];
        let keepGoing = true;

        while (keepGoing) {
            let response = await this.s3.listObjectsV2(params).promise();
            
            (response.Contents || [])
                .map((item) => { return item.Key || ""; })
                .forEach((item) => { files.push(item); });

            if (response.IsTruncated) {
                params.ContinuationToken = response.NextContinuationToken;
            } else {
                keepGoing = false;
            }
        }

        return files;
    }
}