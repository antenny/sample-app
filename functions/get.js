const AWS = require('aws-sdk');
const client = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION
});
const oneMinMs = 1000 * 60;
const cors = {
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'OPTIONS,GET'
};

exports.handler = async evt => {
  if (evt.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: cors
    };
  }
  let body;
  try {
    body = await getBody();
  } catch (err) {
    console.error(err);
    return {
      statusCode: 500,
      headers: cors
    };
  }
  return {
    statusCode: 200,
    headers: Object.assign({}, cors, {
      'Content-Type': 'application/json'
    }),
    body: JSON.stringify(body)
  };
};

const getBody = async () => {
  const now = new Date();
  const millis = now.getTime();
  const currPartKey = getCurrPartKey(millis);
  const lastPartKey = getLastPartKey(millis);
  const resps = await Promise.all([
    getOpenClose(lastPartKey, 'close'),
    getHighLow(currPartKey, 'high'),
    getHighLow(currPartKey, 'low'),
    getOpenClose(currPartKey, 'close')
  ]);
  const time = now.toISOString();
  const [open, high, low, current] = resps;
  return { time, open, high, low, current };
};

const getCurrPartKey = millis => {
  const round = Math.floor(millis / oneMinMs) * oneMinMs;
  const date = new Date(0);
  date.setUTCMilliseconds(round);
  return date.toISOString();
};

const getLastPartKey = millis => {
  const round = Math.floor(millis / oneMinMs) * oneMinMs;
  const last = round - oneMinMs;
  const date = new Date(0);
  date.setUTCMilliseconds(last);
  return date.toISOString();
};

const getOpenClose = async (partKey, openClose) => {
  const scanIdx = openClose === 'open';
  const resp = await client.query({
    TableName: process.env.TABLE_NAME,
    KeyConditionExpression: '#partitionKey = :pk '
      + 'and #sortKey > :sk',
    Limit: 1,
    ScanIndexForward: scanIdx,
    ExpressionAttributeNames: {
      '#partitionKey': 'partitionKey',
      '#sortKey': 'sortKey'
    },
    ExpressionAttributeValues: {
      ':pk': partKey,
      ':sk': 0
    }
  }).promise();
  const item = resp.Item;
  if (!item) {
    return null;
  }
  return !isNaN(item.price) ? item.price : null;
};

const getHighLow = async (partKey, highLow) => {
  const scanIdx = highLow === 'low';
  const resp = await client.query({
    TableName: process.env.TABLE_NAME,
    IndexName: 'partitionKeyByPriceIdx',
    KeyConditionExpression: '#partitionKey = :pk '
      + 'and #price > :prc',
    Limit: 1,
    ScanIndexForward: scanIdx,
    ExpressionAttributeNames: {
      '#partitionKey': 'partitionKey',
      '#price': 'price'
    },
    ExpressionAttributeValues: {
      ':pk': partKey,
      ':prc': -1
    }
  }).promise();
  const item = resp.Item;
  if (!item) {
    return null;
  }
  return !isNaN(item.price) ? item.price : null;
};