const cors = {
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'OPTIONS,POST'
};

exports.handler = async evt => {
  console.log(JSON.stringify(evt));
  return {
    statusCode: 200,
    headers: cors
  };
};