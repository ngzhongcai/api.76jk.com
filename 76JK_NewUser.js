"use strict";
const SECRET= process.env.SECRET;
const aws= require("aws-sdk");
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" }); 
const sns= new aws.SNS({ region: "ap-southeast-1" });
const uuid= require("uuid");
const randomstring= require("randomstring");
const bcrypt= require("bcryptjs"); const salt= 10;

exports.handler= function(event, context, callback) {
  console.log(event); event.body.userId= uuid.v4();
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  queryUserFromDynamo(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("QUERY_USER_FROM_DYNAMO::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_NEW_USER::QUERY_USER_FROM_DYNAMO::" + err.toString()); return; }
    if(res.Count> 0) { context.fail("401::76JK_NEW_USER::USER_ALREADY_EXISTS"); return; }
    hashPassword(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("HASH_PASSWORD::" + (now- last)); last= now;
      if(err) { context.fail("502::76JK_NEW_USER::HASH_PASSWORD::" + err.toString()); return; }
      event.body.hashed= res; event.body.token= randomstring.generate(10);
      updateUserIntoDynamo(event, function(err, res) {
        now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPDATE_USER_INTO_DYNAMO::" + (now- last)); last= now;
        if(err) { context.fail("503::76JK_NEW_USER::UPDATE_USER_INTO_DYNAMO::" + err.toString()); return; }
        processEmailViaSNS(event, function(err, res) {
          now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("PROCESS_EMAIL_VIA_SNS::" + (now- last)); last= now;
          if(err) { context.fail("504::76JK_NEW_USER::PROCESS_EMAIL_VIA_SNS::" + err.toString()); return; }
          const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj);
          const response= { userId: event.body.userId };
          context.succeed({ "response": response });
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

const hashPassword= function(event, callback) {
	bcrypt.hash(event.body.password, salt, function(err, res) {
		err ? callback(err) : callback(null, res);
	});
}

const updateUserIntoDynamo= function(event, callback) {
  const updateExpression=
    "SET email= :email, " +
    "password= :password, " +
    "tags= :tags, " +
    "token_= :token_, " +
    "isVerified= :isVerified, " +
		"lastModified= :lastModified, " +
		"lastCreated= :lastCreated";
	const expressionAttributeValues= { 
		":email": event.body.email.toLowerCase(),
    ":password": event.body.hashed,
    ":tags": [],
    ":token_": event.body.token,
    ":isVerified": false,
		":lastModified": event.body.now,
		":lastCreated": event.body.now
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

const processEmailViaSNS= function(event, callback) {
  var msg= {}; msg.subject= "Get started with your Bonsai journal 🌱"; 
  msg.fromAddress= "hello@76jk.com"; msg.accountId= 847946740020;
	msg.toAddresses= [event.body.email];
  msg.emailBody = 
  "<div style='font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#333'>" +
    "<p>Hi there!</p>" +
    "<h2>Welcome to 76JK 🌱</h2>" +
    "<p>We're excited to have you join <strong>76JK</strong> — your personal Bonsai journal that helps you capture, " + 
    "organize, and reflect on your bonsai journey.</p>" +
    "<p>Before we get started, please verify your email address by visiting the following link:</p>" + 
    "<p><a href='https://api.76jk.com/verify/" + event.body.userId + "/" + event.body.token + "'>" +
    "https://api.76jk.com/verify/" + event.body.userId + "/" + event.body.token + "</a></p>" +
    "<br/><p>Thanks for growing with us 🌿<br/>– The 76JK Team</p>" +
  "</div>";
  var message= JSON.stringify(msg);
  var topicArn= "arn:aws:sns:ap-southeast-1:847946740020:DIGITIVELY_ProcessEmail";
  var params= { Message: message, TopicArn: topicArn }
  sns.publish(params, function(err, res) {
    err ? callback(err) : callback(null, res);
  });
}