"use strict";
const SECRET= process.env.SECRET;
const aws= require("aws-sdk"); const jwt= require("jsonwebtoken"); 
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" });

exports.handler= function(event, context, callback) {
  console.log(event);
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  verify76JK(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("VERIFY_76JK::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_GET_TAG::VERIFY_76JK::" + err.toString()); return; }
    event.jk= res;
    getTagFromDynamo(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("GET_TAG_FROM_DYNAMO::" + (now- last)); last= now;
      if(err) { context.fail("502::76JK_GET_TAG::GET_TAG_FROM_DYNAMO::" + err.toString()); return; }
      const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj);
      if(!res) { context.succeed(); return; }
      res.userId=== event.jk.userId ? context.succeed({ "response": res }) : context.succeed();
    });
  });
}

const verify76JK= function(event, callback) {
  jwt.verify(event.body.jk, SECRET, function(err, res) {
    if(err && err.name=="TokenExpiredError") { callback(null, "TokenExpiredError"); return; }
    err ? callback(err) : callback(null, res);
  });
}

const getTagFromDynamo= function(event, callback) {
	const params= {
		TableName: "76JK-TAGS", ConsistentRead: true,
		Key: { "tagId": event.body.tagId }
	}
	ddc.get(params, function(err, res) {
		err ? callback(err) : callback(null, res.Item);
	});
}