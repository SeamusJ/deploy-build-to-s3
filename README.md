deploy-build-to-s3
==================

"deploy-build-to-s3" is an AWS Lambda function that will deploy a build artifact from a build step in an AWS CodePipeline to an AWS S3 Bucket configured as a website.

Build
-----

    npm run build

The build output will be the compiled lambda function in a ZIP file:

    .\deploy-build-to-s3.zip

Lambda Function
---------------

The ZIP file can be provided as the source code for a lambda function using the Node.js 6.10 runtime. The handler will be "index.handler"

Lambda Role Policy
------------------

The lambda function will need a policy that permits access to your website's S3 bucket. This is an example role policy for a bucket named "example.com":

```
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents"
            ],
            "Resource": "arn:aws:logs:*:*:*"
        },
        {
            "Effect": "Allow",
            "Action": "s3:*",
            "Resource": [
                "arn:aws:s3:::example.com",
                "arn:aws:s3:::example.com/*"
            ]
        },
        {
            "Action": [
                "codepipeline:PutJobSuccessResult",
                "codepipeline:PutJobFailureResult"
            ],
            "Effect": "Allow",
            "Resource": "*"
        }
    ]
}
```

AWS CodePipeline
----------------

To use the lambda function to deploy your built website to your website's S3 bucket, add a action to your build pipeline:
* Action category: Invoke
* Provider: AWS Lambda
* Function name: ```<Name of your Lambda Function>```
* User parameters: ```<Name of your S3 bucket>```
    * You may also optionally add ```,true``` to have the lambda remove files from the target bucket that aren't found in the artifact package.
    * On top of that, you can optionally add a pipe (```|```) separated list of files to exclude from this logic, such as environment-specific script or resource files. 
    * Full usage example: ```mysite-com-live,true,robots.txt```
* Input artifacts #1: ```<output artifact from your build step>```
