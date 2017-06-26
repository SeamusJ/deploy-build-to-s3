interface IEvent {
    "CodePipeline.job": IJob;
}

interface IJob {
    "id": string;
    "accountId": string;
    "data": IJobData;
}

interface IJobData {
    "actionConfiguration": IActionConfiguration;
    "inputArtifacts": IInputArtifacts[];
    "outputArtifacts": any[];
    "artifactCredentials": IArtifactCredentials;
}

interface IActionConfiguration {
    "configuration": IConfiguration;
}

interface IConfiguration {
    "FunctionName": string;
    "UserParameters": string;
}

interface IArtifactCredentials {
    "secretAccessKey": string;
    "sessionToken": string;
    "accessKeyId": string;
}

interface IInputArtifacts {
    "location": IInputArtifactLocation;
    "revision": any;
    "name": string;
}

interface IInputArtifactLocation {
    "s3Location": IS3Location;
    "type": string;
}

interface IS3Location {
    "bucketName": string;
    "objectKey": string;
}