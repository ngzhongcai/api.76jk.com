"use strict";
const SECRET= "cbebfd6c-84da-439b-853b-6a0a50b63edb";
const aws= require("aws-sdk");
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" });
const sns= new aws.SNS({ region: "ap-southeast-1" });
const randomstring= require("randomstring");

exports.handler= function(event, context, callback) {
  console.log(event);
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  queryUserFromDynamo(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("QUERY_USER_FROM_DYNAMO::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_FORGOT::QUERY_USER_FROM_DYNAMO::" + err.toString()); return; }
    if(res.Count== 0) { context.succeed({ "response": true }); return; }
    event.user= res.Items[0]; event.body.token= randomstring.generate(10);
    updateUserIntoDynamo(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPDATE_USER_INTO_DYNAMO::" + (now- last)); last= now;
      if(err) { context.fail("502::76JK_FORGOT::UPDATE_USER_INTO_DYNAMO::" + err.toString()); return; }
      processEmailViaSNS(event, function(err, res) {
        now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("PROCESS_EMAIL_VIA_SNS::" + (now- last)); last= now;
        if(err) { context.fail("503::76JK_FORGOT::PROCESS_EMAIL_VIA_SNS::" + err.toString()); return; }
        const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj);
        context.succeed({ "response": true });
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

const updateUserIntoDynamo= function(event, callback) { 
  const updateExpression=
    "SET token_= :token_, " +
		"lastModified= :lastModified";
	const expressionAttributeValues= {
    ":token_": event.body.token,
		":lastModified": event.body.now
	}
	const params= {
		TableName: "76JK-USERS",
		Key: { "userId": event.user.userId },
		UpdateExpression: updateExpression,
		ExpressionAttributeValues: expressionAttributeValues,
		ReturnValues: "ALL_NEW"
	}
  ddc.update(params, function(err, res) {
    err ? callback(err) : callback(null, res.Attributes);
  });
}

const processEmailViaSNS= function(event, callback) {
  var msg= {}; msg.subject= "Did you forget your 76JK password?"; 
  msg.fromAddress= "hello@76jk.com"; msg.accountId= 847946740020;
	msg.toAddresses= [event.body.email];
  msg.emailBody=
    "<div style='font-family:Arial,sans-serif;font-size:16px;line-height:1.5;color:#333'>" +
    "<p>Hi there,</p>" +
    "<h2>Password Reset Request 🔐</h2>" +
    "<p>We received a request to reset the password for your <strong>76JK</strong> account — your personal Bonsai journal.</p>" +
    "<p>If you made this request, please click the link below to reset your password:</p>" +
    "<p><a href='https://76jk.com/editPassword.html?userId=" + event.user.userId + "&token=" + event.body.token + "'>" +
    "https://76jk.com/editPassword.html?userId=" + event.user.userId + "&token=" + event.body.token + "</a></p>" +
    "<p>If you didn’t request a password reset, you can safely ignore this email — your account remains secure.</p>" +
    "<br/><p>Stay rooted 🌿<br/>– The 76JK Team</p>" +
    "</div>";
  var message= JSON.stringify(msg);
  var topicArn= "arn:aws:sns:ap-southeast-1:847946740020:DIGITIVELY_ProcessEmail";
  var params= { Message: message, TopicArn: topicArn }
  sns.publish(params, function(err, res) {
    err ? callback(err) : callback(null, res);
  });
}