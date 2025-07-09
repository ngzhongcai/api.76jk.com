"use strict";
const SECRET= process.env.SECRET;
const aws= require("aws-sdk");
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" });
const bcrypt= require("bcryptjs"); const salt= 10;
const jwt= require("jsonwebtoken");

exports.handler= function(event, context, callback) {
  console.log(event);
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  queryUserFromDynamo(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("QUERY_USER_FROM_DYNAMO::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_LOGIN::QUERY_USER_FROM_DYNAMO::" + err.toString()); return; }
    if(res.Count== 0) { context.succeed({ "response": false }); return; }
    event.user= res.Items[0];
    comparePassword(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("COMPARE_PASSWORD::" + (now- last)); last= now;
      if(err) { context.fail("502::76JK_LOGIN::COMPARE_PASSWORD::" + err.toString()); return; }
      if(!res) { context.succeed({ "response": false }); return; }
      updateUserIntoDynamo(event, function(err, res) {
        now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPDATE_USER_INTO_DYNAMO::" + (now- last)); last= now;
        if(err) { context.fail("503::76JK_LOGIN::UPDATE_USER_INTO_DYNAMO::" + err.toString()); return; } 
        generateResponse(event, function(err, res) {
          now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("GENERATE_RESPONSE::" + (now- last)); last= now;
          if(err) { context.fail("504::76JK_LOGIN::GENERATE_RESPONSE::" + err.toString()); return; }
          var obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj);
          context.succeed({ "response": res });
        });
      });
    });
  });
}

const queryUserFromDynamo= function(event, callback) {
  const params= {
    TableName: "76JK-USERS", IndexName: "EMAIL",
    KeyConditionExpression: "email= :email",
    ExpressionAttributeValues: { ":email": event.body.email }
  }
  ddc.query(params, function(err, res) {
    err ? callback(err) : callback(null, res);
  });
}

const comparePassword= function(event, callback) {
	bcrypt.compare(event.body.password, event.user.password, function(err, res) {
		err ? callback(err) : callback(null, res);
	});
}

const updateUserIntoDynamo= function(event, callback) {
  const updateExpression=
    "SET lastModified= :lastModified";
  const expressionAttributeValues= {  
    ":lastModified": event.body.now
  }
  const params= {
    TableName: "76JK-USERS",
    Key: { "userId": event.user.userId },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "NONE"
  }
  ddc.update(params, function(err, res) {
    err ? callback(err) : callback(null, res.Attributes);
  });
}

var generateResponse= function(event, callback) {
  var token= {};
  token.userId= event.user.userId;
  token.email= event.body.email;
  callback(null, jwt.sign(token, SECRET, { expiresIn: 31536000 }));
}