"use strict";
const SECRET= "cbebfd6c-84da-439b-853b-6a0a50b63edb";
const aws= require("aws-sdk");
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" }); 
const sns= new aws.SNS({ region: "ap-southeast-1" });
const uuid= require("uuid");

exports.handler= function(event, context, callback) {
  console.log(event); event.body.userId= uuid.v4();
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  updateUserIntoDynamo(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPDATE_USER_INTO_DYNAMO::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_NEW_USER::UPDATE_USER_INTO_DYNAMO::" + err.toString()); return; }
    processEmailViaSNS(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPDATE_USER_INTO_DYNAMO::" + (now- last)); last= now;
      if(err) { context.fail("501::76JK_NEW_USER::UPDATE_USER_INTO_DYNAMO::" + err.toString()); return; }
      const response= { userId: event.body.userId };
      context.succeed({ "response": response });
    });
  });
}

const updateUserIntoDynamo= function(event, callback) {
  const updateExpression=
    "SET userId= :userId, " +
    "email= :email, " +
    "password= :password, " +
    "bonsais= :bonsais, " +
    "isVerified= :isVerified, " +
		"lastModified= :lastModified, " +
		"lastCreated= :lastCreated";
	const expressionAttributeValues= {
		":userId": event.body.userId,
		":email": event.body.email,
    ":password": " ",
    ":bonsais": [],
    ":isVerified": false,
		":lastModified": event.body.now,
		":lastCreated": event.body.now
	}
	const params= {
		TableName: "76JK-USERS",
		Key: { "userId": event.body.userId },
		UpdateExpression: updateExpression,
		ExpressionAttributeValues: expressionAttributeValues,
		ReturnValues: "UPDATED_NEW"
	}
  ddc.update(params, function(err, res) {
    err ? callback(err) : callback(null, res.Attributes);
  });
}

const processEmailViaSNS= function(event, callback) {
  var msg= {}; msg.subject= "Welcome to 76JK"; msg.fromAddress= "hello@76jk.com"; msg.accountId= 847946740020;
	msg.toAddresses= [event.body.email]; msg.emailBody= "Welcome to 76JK, your easy Bonsai journal. Please verify your email at https://76jk.com/verify.html?userId=" + event.body.userId; var message= JSON.stringify(msg);
  var topicArn= "arn:aws:sns:ap-southeast-1:847946740020:DIGITIVELY_ProcessEmail";
  var params= { Message: message, TopicArn: topicArn }
  sns.publish(params, function(err, res) {
    err ? callback(err) : callback(null, res);
  });
}