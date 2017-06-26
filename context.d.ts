interface IContext {
    "callbackWaitsForEmptyEventLoop": boolean;
    "logGroupName": string;
    "logStreamName": string;
    "functionName": string;
    "memoryLimitInMB": string;
    "functionVersion": string;
    "invokeid": string;
    "awsRequestId": string;
    "invokedFunctionArn": string;

    fail(err: string | AWS.AWSError): void;
    succeed(message: string): void;
}