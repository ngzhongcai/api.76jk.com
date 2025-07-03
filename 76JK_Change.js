"use strict";
const SECRET= "cbebfd6c-84da-439b-853b-6a0a50b63edb";
const aws= require("aws-sdk");
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" });
const bcrypt= require("bcryptjs"); const salt= 10;
const jwt= require("jsonwebtoken");

exports.handler= function(event, context, callback) {
  console.log(event);
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  hashPassword(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("HASH_PASSWORD::" + (now- last)); last= now;
    if(err) { context.fail("502::76JK_CHANGE::HASH_PASSWORD::" + err.toString()); return; }
    event.body.hashed= res;
    updateUserIntoDynamo(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPDATE_USER_INTO_DYNAMO::" + (now- last)); last= now;
      if(err) { context.fail("503::76JK_CHANGE::UPDATE_USER_INTO_DYNAMO::" + err.toString()); return; }
      event.user= res;
      generateResponse(event, function(err, res) {
        now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("GENERATE_RESPONSE::" + (now- last)); last= now;
        if(err) { context.fail("503::76JK_CHANGE::GENERATE_RESPONSE::" + err.toString()); return; }
        const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj);
        context.succeed({ "response": res });
      });

    });
  });
}

const hashPassword= function(event, callback) {
  bcrypt.hash(event.body.password, salt, function(err, res) {
    err ? callback(err) : callback(null, res);
  });
}

const updateUserIntoDynamo= function(event, callback) {
  const updateExpression=
    "SET password= :password, " + 
    "lastModified= :lastModified";
  const expressionAttributeValues= {  
    ":password": event.body.hashed,
    ":lastModified": event.body.now
  }
  const params= {
    TableName: "76JK-USERS",
    Key: { "userId": event.body.userId },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW"
  }
  ddc.update(params, function(err, res) {
    err ? callback(err) : callback(null, res.Attributes);
  });
}

var generateResponse= function(event, callback) {
  var token= {};
  token.userId= event.body.userId;
  token.email= event.user.email;
  callback(null, jwt.sign(token, SECRET, { expiresIn: 31536000 }));
}