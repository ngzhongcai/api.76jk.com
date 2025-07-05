// NOTE: FUNCTION TO BE CALLED MANUALLY BY ADMIN ONLY 
"use strict";
const SECRET= "cbebfd6c-84da-439b-853b-6a0a50b63edb";
const aws= require("aws-sdk"); 
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" }); 
const sns= new aws.SNS({ region: "ap-southeast-1" });
const uuid= require("uuid"); 

exports.handler= function(event, context, callback) {
  console.log(event); event.body.tagId= uuid.v4();
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  updateTagIntoDynamo(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPDATE_TAG_INTO_DYNAMO::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_NEW_TAG::UPDATE_TAG_INTO_DYNAMO::" + err.toString()); return; }    
    processGenerateQRViaSNS(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("PROCESS_GENERATE_STATIC_VIA_SNS::" + (now- last)); last= now;
      if(err) { context.fail("502::76JK_NEW_TAG::PROCESS_GENERATE_QR_VIA_SNS::" + err.toString()); return; }
      const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj);
      const response= { tagId: event.body.tagId };
      context.succeed({ "response": response });
    }); 
  });
}

const updateTagIntoDynamo= function(event, callback) {
  const updateExpression=
    "SET name_= :name_, " + 
    "userId= :userId, " +
    "entries= :entries, " +
    "firstCreated= :firstCreated, " + 
    "lastUpdated= :lastUpdated";
	const expressionAttributeValues= {
    ":name_": " ",
    ":userId": " ",
    ":entries": [],
    ":firstCreated": event.body.now, 
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

const processGenerateQRViaSNS= function(event, callback) {
  var msg= {}; msg.jk= event.body.jk; msg.tagId= event.body.tagId;
  var message= JSON.stringify(msg);
  var topicArn= "arn:aws:lambda:ap-southeast-1:847946740020:function:76JK_GenerateQR";
  var params= { Message: message, TopicArn: topicArn }
  sns.publish(params, function(err, res) {
    err ? callback(err) : callback(null, res);
  });
}