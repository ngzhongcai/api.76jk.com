"use strict";
const SECRET= "930098a0-1efa-4cbf-b7b3-7471db09d1d7";
const aws= require("aws-sdk"); const jwt= require("jsonwebtoken"); var async= require("async");
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" });

exports.handler= function(event, context, callback) {
  console.log(event);
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  verifyFlowers(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("VERIFY_FLOWERS::" + (now- last)); last= now;
    if(err) { context.fail("501::FLOWERS_GET_FLOWERS::VERIFY_FLOWERS::" + err.toString()); return; }
    event.flowers= res; if(event.flowers.redirect_uri) { context.fail("401::FLOWERS_GET_FLOWERS::NOT_ALLOWED"); return; }
    iterateScanFlowersFromDynamo(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("ITERATE_SCAN_FLOWERS_FROM_DYNAMO::" + (now- last)); last= now;
      if(err) { context.fail("502::FLOWERS_GET_FLOWERS::ITERATE_SCAN_FLOWERS_FROM_DYNAMO::" + err.toString()); return; } 
      const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj); 
      context.succeed({ "response": event.records });
    });
  });
}

const verifyFlowers= function(event, callback) {
  jwt.verify(event.body.flowers, SECRET, function(err, res) {
    if(err && err.name=="TokenExpiredError") { callback(null, "TokenExpiredError"); return; }
    err ? callback(err) : callback(null, res);
  });
}

const iterateScanFlowersFromDynamo= function(event, callback) {
  var params= { TableName: "FLOWERS-76JK" }
	if(event.lastEvaluatedKey) { params.ExclusiveStartKey= event.lastEvaluatedKey; }
	ddc.scan(params, function(err, res) {
    if(err) { callback(err); return; } 
    event.lastEvaluatedKey= res.LastEvaluatedKey ? res.LastEvaluatedKey : undefined;
    event.records= event.records ? event.records.concat(res.Items) : res.Items; 
    event.lastEvaluatedKey ? iterateScanFlowersFromDynamo(event, callback) : callback();
  });
}