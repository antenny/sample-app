# sample-app

This is a sample project intended to show how to use antenny. It leverages [aws-cdk](https://aws.amazon.com/cdk/) along with antenny constructs from the [antenny-cdk](https://github.com/antenny/antenny-cdk).

The app captures realtime trades from the [gemni exchange](https://www.gemini.com/) via their [public websocket api](https://docs.gemini.com/websocket-api/).

It partitions trades by minute and allows you to view the current minute:

* opening price
* high price
* low price
* current price
