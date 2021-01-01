# sample-app

This is a sample project intended to show how to use antenny. It leverages [aws-cdk](https://aws.amazon.com/cdk/) along with antenny constructs from [antenny-cdk](https://github.com/antenny/antenny-cdk).

### Background

The app captures realtime trades from the [gemni exchange](https://www.gemini.com/) via their [public websocket api](https://docs.gemini.com/websocket-api/).

It partitions trades by minute and allows you to view the current minute:

* opening price
* high price
* low price
* current price

### Dependencies

* aws-cli
* node
* aws-cdk

### Usage

To get started you'll first need to subscribe to [antenny](https://antenny.io) if you haven't yet. Once subscribed you'll create some secrets in your aws account. This is a best practice to handle sensitive parameters and keys within your aws account.

#### 1. Create Customer Secret

Find your secret on the [admin dashboard](https://admin.antenny.io/dashboard). Your customer secret lets your app verify antenny is the actual sender of incomming requests. Replace `customerSecret` with the value copied from your dashboard.

```shell
aws secretsmanager create-secret --name atyCustSecret --secret-string customerSecret
```

#### 2. Create Customer Id Parameter

Find your customer id on the [admin dashboard](https://admin.antenny.io/dashboard). We use an ssm parameter because your customer id isn't sensitive. Replace `--value` flag with your customer id.

```shell
aws ssm put-parameter --name /antenny/customerId --value customerId
```

#### 3. Create a Client ApiKey Secret

You'll need to create a client for your antenny account. Create one on the [clients page](https://admin.antenny.io/clients). Navigate to your created client and replace `--secret-string` with your copied api key.

```shell
aws secretsmanager create-secret --name atyApiKey --secret-string apiKey
```

#### 4. Clone Repository and Install Dependencies

After you clone the repository, install npm dependencies.

```shell
npm ci
```

#### 5. Create App

You're all ready to create the app. Deploy with aws-cdk.

```shell
cdk deploy SampleStack
```

#### Verify

Once deployed, you can go to your cloudformation console and there will be a stack output for `SampleStack` that will have your api url. You can plug this into your browser suffixed with `/view`. You'll be greeted with a json document with the aforementioned data points. Note some may be null. Once the data starts to filter in you can refresh and that data will populate.

#### 6. Destroy App

Once your satisfied with the app, you can destroy it to avoid incurring further charges.

```shell
cdk destroy SampleStack
```

#### Further Development

You can use this sample-app as scaffolding to make your own app. To learn more about how antenny interacts with the app, you can reference [antenny docs](https://antenny.io/docs). If you have questions you can always [contact us](https://antenny.io/contact.html).