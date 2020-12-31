const crypto = require('crypto');
const AWS = require('aws-sdk');
const client = new AWS.DynamoDB.DocumentClient({
  region: process.env.AWS_REGION
});
const oneMinMs = 1000 * 60;
const cors = {
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST'
};

exports.handler = async evt => {
  console.log(JSON.stringify(evt));
  if (evt.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: cors
    };
  }
  if (!checkSig(evt)) {
    return {
      statusCode: 400,
      headers: cors
    };
  }
  const body = parseKey(evt, 'body');
  if (!body) {
    return {
      statusCode: 400,
      headers: cors
    };
  }
  if (body.event !== 'received') {
    // pass on other events
    return {
      statusCode: 200,
      headers: cors
    };
  }
  const msg = parseKey(body, 'message');
  if (!msg) {
    return {
      statusCode: 400,
      headers: cors
    };
  }
  await processMsg(msg);
  return {
    statusCode: 200,
    headers: cors
  };
};

const checkSig = evt => {
  const sig = evt.headers && evt.headers['X-Antenny-Sig'];
  if (!sig) {
    console.error('No Signature!');
    return false;
  }
  const body = evt.body;
  if (!body) {
    console.error('No Body Included!');
    return false;
  }
  const secret = process.env.ANTENNY_SECRET;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(body);
  if (sig !== hmac.digest('base64')) {
    console.error('Bad Signature!');
    return false;
  }
  return true;
};

const parseKey = (parse, key) => {
  if (!parse[key]) {
    console.error(`No key for: ${key}!`);
    return false;
  }
  let parsed;
  try {
    parsed = JSON.parse(parse[key]);
  } catch (err) {
    console.error(err.message);
    return null;
  }
  return parsed;
};

const processMsg = async msg => {
  const evts = msg.events;
  if (!Array.isArray(evts)) {
    return;
  }
  for (let i = 0; i < evts.length; i++) {
    const evt = evts[i];
    const tradeId = evt.tid;
    const price = evt.price;
    const amount = evt.amount;
    const makerSide = evt.makerSide;
    if (!tradeId || !price || !amount || !makerSide) {
      continue;
    }
    const key = getKey(evt);
    if (!key) {
      continue;
    }
    const { partitionKey, sortKey } = key;
    const created = new Date().toISOString();
    await client.put({
      TableName: process.env.TABLE_NAME,
      Item: {
        partitionKey,
        sortKey,
        tradeId,
        price,
        amount,
        makerSide,
        created
      }
    }).promise();
  }
};

const getKey = evt => {
  const millis = evt.timestampms;
  if (isNaN(millis)) {
    return null;
  }
  const round = Math.floor(millis / oneMinMs) * oneMinMs;
  const date = new Date(0);
  date.setUTCMilliseconds(round);
  const inter = date.toISOString();
  return {
    partitionKey: inter,
    sortKey: millis
  };
};