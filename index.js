const path = require('path');
const fs = require('fs');
const core = require('@aws-cdk/core');
const iam = require('@aws-cdk/aws-iam');
const ssm = require('@aws-cdk/aws-ssm');
const secretsmanager = require('@aws-cdk/aws-secretsmanager');
const dynamodb = require('@aws-cdk/aws-dynamodb');
const lambda = require('@aws-cdk/aws-lambda');
const apigateway = require('@aws-cdk/aws-apigatewayv2');
const integrations = require('@aws-cdk/aws-apigatewayv2-integrations');
const antenny = require('antenny-cdk');

class SampleStack extends core.Stack {
  constructor(scope, id, props) {
    super(scope, id, props);
    const table = new dynamodb.Table(this, 'Table', {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        type: dynamodb.AttributeType.STRING,
        name: 'partitionKey'
      },
      sortKey: {
        type: dynamodb.AttributeType.NUMBER,
        name: 'sortKey'
      }
    });
    table.addLocalSecondaryIndex({
      indexName: 'partitionKeyByPriceIdx',
      projectionType: dynamodb.ProjectionType.ALL,
      sortKey: {
        type: dynamodb.AttributeType.NUMBER,
        name: 'price'
      }
    });
    const getFnRole = new iam.Role(this, 'GetFnRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        )
      ],
      inlinePolicies: {
        dynamodb: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: 'dynamodb',
              effect: iam.Effect.ALLOW,
              actions: ['dynamodb:Query'],
              resources: [
                table.tableArn,
                core.Fn.join('/', [
                  table.tableArn,
                  'index',
                  'partitionKeyByPriceIdx'
                ])
              ]
            })
          ]
        })
      }
    });
    const getFn = new lambda.Function(this, 'GetFn', {
      role: getFnRole,
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      memorySize: 256,
      timeout: core.Duration.seconds(30),
      code: lambda.Code.fromInline(fs.readFileSync(path.join(
        __dirname,
        'functions',
        'get.js'
      ), { encoding: 'utf8' })),
      environment: {
        TABLE_NAME: table.tableName
      }
    });
    const postFnRole = new iam.Role(this, 'PostFnRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        )
      ],
      inlinePolicies: {
        dynamodb: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              sid: 'dynamodb',
              effect: iam.Effect.ALLOW,
              actions: ['dynamodb:PutItem'],
              resources: [table.tableArn]
            })
          ]
        })
      }
    });
    const custSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'CustSecret',
      'atyCustSecret'
    );
    const postFn = new lambda.Function(this, 'PostFn', {
      role: postFnRole,
      runtime: lambda.Runtime.NODEJS_12_X,
      handler: 'index.handler',
      memorySize: 256,
      timeout: core.Duration.seconds(30),
      code: lambda.Code.fromInline(fs.readFileSync(path.join(
        __dirname,
        'functions',
        'post.js'
      ), { encoding: 'utf8' })),
      environment: {
        TABLE_NAME: table.tableName,
        ANTENNY_SECRET: custSecret.secretValue.value
      }
    });
    const getFnInteg = new integrations.LambdaProxyIntegration({
      handler: getFn
    });
    const postFnInteg = new integrations.LambdaProxyIntegration({
      handler: postFn
    });
    const api = new apigateway.HttpApi(this, 'Api', {
      corsPreflight: {
        allowHeaders: ['Authorization', 'X-Antenny-Sig'],
        allowMethods: ['*'],
        allowOrigins: ['*'],
        maxAge: core.Duration.days(10)
      }
    });
    api.addRoutes({
      path: '/view',
      methods: [apigateway.HttpMethod.GET],
      integration: getFnInteg
    });
    api.addRoutes({
      path: '/endpoint',
      methods: [apigateway.HttpMethod.POST],
      integration: postFnInteg
    });
    const apiSecret = secretsmanager.Secret.fromSecretNameV2(
      this,
      'ApiSecret',
      'atyApiKey'
    );
    const sub = new antenny.Subscription(this, 'Sub', {
      apiKey: apiSecret.secretValue.value,
      subscription: {
        name: 'example-subscription',
        customerId: ssm.StringParameter.valueFromLookup(
          this,
          '/antenny/customerId'
        ),
        region: this.region,
        resource: {
          protocol: 'ws',
          url: 'wss://api.gemini.com/v1/marketdata/BTCUSD/'
           + '?bids=false&offers=false&auctions=false&trades=true'
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
    new core.CfnOutput(this, 'ApiUrl', {
      value: api.url
    });
    new core.CfnOutput(this, 'SubId', {
      value: sub.attrId
    });
  }
}

const app = new core.App();
new SampleStack(app, 'SampleStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  }
});
app.synth();