"use strict";
const SECRET= "cbebfd6c-84da-439b-853b-6a0a50b63edb";
const aws= require("aws-sdk"); const jwt= require("jsonwebtoken"); 
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" });
const sns= new aws.SNS({ region: "ap-southeast-1" });

exports.handler= function(event, context, callback) {
  console.log(event);
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  verify76JK(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("VERIFY_76JK::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_CLAIM_TAG::VERIFY_76JK::" + err.toString()); return; }
    event.jk= res;
    getTagFromDynamo(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("GET_TAG_FROM_DYNAMO::" + (now- last)); last= now;
      if(err) { context.fail("502::76JK_CLAIM_TAG::GET_TAG_FROM_DYNAMO::" + err.toString()); return; }
      updateTagIntoDynamo(event, function(err, res) {
        now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPDATE_TAG_INTO_DYNAMO::" + (now- last)); last= now;
        if(err) { context.fail("503::76JK_CLAIM_TAG::UPDATE_TAG_INTO_DYNAMO::" + err.toString()); return; }
        updateUserIntoDynamo(event, function(err, res) {
          now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPDATE_USER_INTO_DYNAMO::" + (now- last)); last= now;
          if(err) { context.fail("504::76JK_CLAIM_TAG::UPDATE_USER_INTO_DYNAMO::" + err.toString()); return; }
          processGenerateStaticViaSNS(event, function(err, res) {
            now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("PROCESS_GENERATE_STATIC_VIA_SNS::" + (now- last)); last= now;
            if(err) { context.fail("505::76JK_CLAIM_TAG::PROCESS_GENERATE_STATIC_VIA_SNS::" + err.toString()); return; }
            const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj);
            const response= { tagId: event.body.tagId };
            context.succeed({ "response": response });
          });
        });
      });
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

const updateTagIntoDynamo= function(event, callback) {
  const updateExpression=
    "SET name_= :name_, " + 
    "userId= :userId, " +
    "lastUpdated= :lastUpdated";
	const expressionAttributeValues= {
    ":name_": event.body.name,
    ":userId": event.jk.userId,
    ":lastUpdated": event.body.now    
	}
	const params= {
		TableName: "76JK-TAGS",
    Key: { "tagId": event.body.tagId },
		UpdateExpression: updateExpression,
		ExpressionAttributeValues: expressionAttributeValues,
		ReturnValues: "ALL_NEW"
	}
	ddc.update(params, function(err, res) {
		err ? callback(err) : callback(null, res.Attributes);
	});
}

const updateUserIntoDynamo= function(event, callback) {
  const updateExpression=
    "SET tags= list_append(tags, :tag), " +
		"lastModified= :lastModified";
	const expressionAttributeValues= { 
    ":tag": [event.body.tag], 
		":lastModified": event.body.now
	}
	const params= {
		TableName: "76JK-USERS",
		Key: { "userId": event.jk.userId },
		UpdateExpression: updateExpression,
		ExpressionAttributeValues: expressionAttributeValues,
		ReturnValues: "ALL_NEW"
	}
  ddc.update(params, function(err, res) {
    err ? callback(err) : callback(null, res.Attributes);
  });
}

const processGenerateStaticViaSNS= function(event, callback) {
  var msg= {}; msg.jk= event.body.jk; msg.tagId= event.body.tagId;
  var message= JSON.stringify(msg);
  var topicArn= "arn:aws:sns:ap-southeast-1:847946740020:processGenerateStatic";
  var params= { Message: message, TopicArn: topicArn }
  sns.publish(params, function(err, res) {
    err ? callback(err) : callback(null, res);
  });
}