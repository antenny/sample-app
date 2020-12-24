const path = require('path');
const fs = require('fs');
const core = require('@aws-cdk/core');
const iam = require('@aws-cdk/aws-iam');
const ssm = require('@aws-cdk/aws-ssm');
const secretsmanager = require('@aws-cdk/aws-secretsmanager');
const lambda = require('@aws-cdk/aws-lambda');
const apigateway = require('@aws-cdk/aws-apigatewayv2');
const integrations = require('@aws-cdk/aws-apigatewayv2-integrations');
const antenny = require('antenny-cdk');

class ExampleStack extends core.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);
    const apiFnRole = new iam.Role(this, 'ApiFnRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        )
      ]
    });
    const apiFn = new lambda.Function(this, 'ApiFn', {
      role: apiFnRole,
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      memorySize: 256,
      timeout: core.Duration.seconds(30),
      code: lambda.Code.fromInline(fs.readFileSync(path.join(
        __dirname,
        'function',
        'index.js'
      ), { encoding: 'utf8' }))
    });
    const apiFnInteg = new integrations.LambdaProxyIntegration({
      handler: apiFn
    });
    const api = new apigateway.HttpApi(this, 'Api', {
      corsPreflight: {
        allowHeaders: ['Authorization', 'X-Antenny-Sig'],
        allowMethods: [apigateway.HttpMethod.ANY],
        allowOrigins: ['*'],
        maxAge: core.Duration.days(10)
      }
    });
    api.addRoutes({
      path: '/endpoint',
      methods: [apigateway.HttpMethod.ANY],
      integration: apiFnInteg
    });
    const secret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'Secret',
      'antennyApiKey'
    );
    const sub = new antenny.Subscription(this, 'Sub', {
      apiKey: secret.secretValue.value,
      subscription: {
        name: 'example-subscription',
        customerId: ssm.StringParameter.valueFromLookup(
          this,
          '/antenny/customerId'
        ),
        region: this.region,
        resource: {
          protocol: 'ws',
          url: ''
        },
        endpoint: {
          protocol: 'http',
          url: core.Fn.join('', [
            api.url,
            'endpoint'
          ])
        }
      }
    });
    new core.CfnOutput(this, 'SubId', {
      value: sub.attrId
    });
  }
}

const app = new core.App();
new ExampleStack(app, 'ExampleStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  }
});
app.synth();