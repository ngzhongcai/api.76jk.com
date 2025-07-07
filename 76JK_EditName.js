"use strict";
const SECRET= "cbebfd6c-84da-439b-853b-6a0a50b63edb";
const aws= require("aws-sdk"); const jwt= require("jsonwebtoken"); 
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" }); 

exports.handler= function(event, context, callback) {
  console.log(event);
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  verify76JK(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("VERIFY_76JK::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_EDIT_NAME::VERIFY_76JK::" + err.toString()); return; }
    event.jk= res;
    updateTagIntoDynamo(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPDATE_TAG_INTO_DYNAMO::" + (now- last)); last= now;
      if(err) { context.fail("502::76JK_EDIT_NAME::UPDATE_TAG_INTO_DYNAMO::" + err.toString()); return; }
      const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj); 
      context.succeed({ "response": res });
    });
  });
}

const verify76JK= function(event, callback) {
  jwt.verify(event.body.jk, SECRET, function(err, res) {
    if(err && err.name=="TokenExpiredError") { callback(null, "TokenExpiredError"); return; }
    err ? callback(err) : callback(null, res);
  });
} 

const updateTagIntoDynamo= function(event, callback) {
  const updateExpression=
    "SET name_= :name_, " +
    "lastModified= :lastModified";
	const expressionAttributeValues= {
    ":name_": event.body.name, 
    ":lastModified": event.body.now,
    ":expectedUserId": event.jk.userId   
	}
  const conditionExpression= "userId= :expectedUserId";
	const params= {
		TableName: "76JK-TAGS",
    Key: { "tagId": event.body.tagId },
		UpdateExpression: updateExpression,
		ExpressionAttributeValues: expressionAttributeValues,
    ConditionExpression: conditionExpression,
		ReturnValues: "ALL_NEW"
	}
	ddc.update(params, function(err, res) {
		err ? callback(err) : callback(null, res.Attributes);
	});
} 