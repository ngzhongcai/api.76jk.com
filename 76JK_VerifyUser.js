"use strict";
const SECRET= process.env.SECRET;
const aws= require("aws-sdk");
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" });
const jwt= require("jsonwebtoken");

exports.handler= function(event, context, callback) {
  console.log(event); event.body= {}; const parts= event.path.split("/"); event.body.userId= parts[2]; event.body.token= parts[3];
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  getUserFromDynamo(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("GET_USER_FROM_DYNAMO::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_VERIFY_USER::GET_USER_FROM_DYNAMO::" + err.toString()); return; }
    event.body.isVerified= res && res.token_== event.body.token;
    updateUserIntoDynamo(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPDATE_USER_INTO_DYNAMO::" + (now- last)); last= now;
      if(err) { context.fail("502::76JK_VERIFY_USER::UPDATE_USER_INTO_DYNAMO::" + err.toString()); return; }
      event.user= res;
      generateResponse(event, function(err, res) {
        now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("GENERATE_RESPONSE::" + (now- last)); last= now;
        if(err) { context.fail("503::76JK_VERIFY_USER::GENERATE_RESPONSE::" + err.toString()); return; }
        const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj); 
        context.succeed(res);
      });
    });
  });
}

const getUserFromDynamo= function(event, callback) {
	const params= {
		TableName: "76JK-USERS", ConsistentRead: true,
		Key: { "userId": event.body.userId }
	}
	ddc.get(params, function(err, res) {
		err ? callback(err) : callback(null, res.Item);
	});
}

const updateUserIntoDynamo= function(event, callback) {
  if(!event.body.isVerified) { callback(); return; } 
  const updateExpression=
    "SET isVerified= :isVerified, " +
		"lastModified= :lastModified";
	const expressionAttributeValues= {
    ":isVerified": true,
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

const generateResponse= function(event, callback) {
  var response= {}; response.statusCode= 302; response.headers= {};
  if(!event.body.isVerified) {
    response.headers.Location= "https://76jk.com";
    callback(null, response); return;
  }
  var token= {}; 
  token.userId= event.body.userId; 
  token.email= event.user.email;
  const jk= jwt.sign(token, SECRET, { expiresIn: 31536000 });
  response.headers.Location= "https://76jk.com/verified.html?jk=" + jk;
  callback(null, response); return;
}