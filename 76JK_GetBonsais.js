"use strict";
const SECRET= "cbebfd6c-84da-439b-853b-6a0a50b63edb";
const aws= require("aws-sdk"); const jwt= require("jsonwebtoken");
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" });

exports.handler= function(event, context, callback) {
  console.log(event);
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  verify76JK(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("VERIFY_76JK::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_GET_BONSAIS::VERIFY_76JK::" + err.toString()); return; }
    event.jk= res; if(event.jk.redirect_uri) { context.fail("401::76JK_GET_BONSAIS::NOT_ALLOWED"); return; }
    iterateScanBonsaisFromDynamo(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("ITERATE_SCAN_BONSAIS_FROM_DYNAMO::" + (now- last)); last= now;
      if(err) { context.fail("502::76JK_GET_BONSAIS::ITERATE_SCAN_BONSAIS_FROM_DYNAMO::" + err.toString()); return; } 
      const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj); 
      context.succeed({ "response": event.records });
    });
  });
}

const verify76JK= function(event, callback) {
  jwt.verify(event.body.jk, SECRET, function(err, res) {
    if(err && err.name=="TokenExpiredError") { callback(null, "TokenExpiredError"); return; }
    err ? callback(err) : callback(null, res);
  });
}

const iterateScanBonsaisFromDynamo= function(event, callback) {
  var params= { TableName: "76JK-BONSAIS" }
	if(event.lastEvaluatedKey) { params.ExclusiveStartKey= event.lastEvaluatedKey; }
	ddc.scan(params, function(err, res) {
    if(err) { callback(err); return; } 
    event.lastEvaluatedKey= res.LastEvaluatedKey ? res.LastEvaluatedKey : undefined;
    event.records= event.records ? event.records.concat(res.Items) : res.Items; 
    event.lastEvaluatedKey ? iterateScanBonsaisFromDynamo(event, callback) : callback();
  });
}