import * as AWS from "aws-sdk";

export interface IErrorHandler {
    (message: string, err: object): void;
}

export class Website {
    private s3: AWS.S3;

    constructor(private bucketName: string, private onError: IErrorHandler) {
        this.s3 = new AWS.S3({ apiVersion: '2006-03-01' });
    }

    uploadFileFromStream(fileName: string, stream: any) {
        var data = "";

        stream
            .on("data", (chunk: string) => {
                data += chunk;
            })
            .on("end", () => {
                var params = {
                    Body: data,
                    Bucket: this.bucketName,
                    Key: fileName,
                    ContentType: this.getContentTypeForFile(fileName),
                    ACL: "public-read"
                };

                this.s3.putObject(params, (err: object) => {
                    if(err){
                        this.onError("Error uploading file to s3 bucket", err);
                    }
                });
            });
    }

    private getContentTypeForFile(fileName: string): string {
        switch (this.getFileExtension(fileName)) {
        case "html":
        case "htm":
            return "text/html";
        case "js":
            return "application/x-javascript";
        case "css":
            return "text/css";
        default:
            return "text/" + this.getFileExtension(fileName);
        }
    }

    private getFileExtension(fileName: string): string {
        return fileName.substr(fileName.lastIndexOf('.') + 1);
    }
}