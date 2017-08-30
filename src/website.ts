import * as AWS from "aws-sdk";
import * as mimeTypes from "mime-types";

export interface IErrorHandler {
    (message: string, err: object): void;
}

export class Website {
    private s3: AWS.S3;

    constructor(private bucketName: string, private onError: IErrorHandler) {
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
}