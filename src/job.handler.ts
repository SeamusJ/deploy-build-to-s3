import * as AWS from "aws-sdk";

export class JobHandler {
    constructor(private job: IJob, private context: IContext) { }

    putJobSuccess(message: string) {
        var codepipeline = new AWS.CodePipeline();
        
        var params = {
            jobId: this.job.id
        };

        codepipeline.putJobSuccessResult(params, (err) => {
                if(err) {
                    this.context.fail(err);
                } else {
                    this.context.succeed(message);
                }
            });
    }

    putJobFailure(message: string) {
        var codepipeline = new AWS.CodePipeline();

        var params = {
            jobId: this.job.id,
            failureDetails: {
                message: JSON.stringify(message),
                type: 'JobFailed',
                externalExecutionId: this.context.invokeid
            }
        };
        codepipeline.putJobFailureResult(params, () => {
            this.context.fail(message);
        });
    }
}