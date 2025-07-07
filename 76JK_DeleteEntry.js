"use strict";
const SECRET= "cbebfd6c-84da-439b-853b-6a0a50b63edb";
const aws= require("aws-sdk"); const jwt= require("jsonwebtoken"); 
const s3= new aws.S3({ region: "ap-southeast-1" });
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" });
const sns= new aws.SNS({ region: "ap-southeast-1" });

exports.handler= function(event, context, callback) {
  console.log(event);
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  verify76JK(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("VERIFY_76JK::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_DELETE_ENTRY::VERIFY_76JK::" + err.toString()); return; }
    event.jk= res;
    getTagFromDynamo(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("GET_TAG_FROM_DYNAMO::" + (now- last)); last= now;
      if(err) { context.fail("502::76JK_DELETE_ENTRY::GET_TAG_FROM_DYNAMO::" + err.toString()); return; }
      event.body.updatedEntries= res.entries.filter(function(entry) { return entry.entryId!== event.body.entryId; });
      updateTagIntoDynamo(event, function(err, res) {
        now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPDATE_TAG_INTO_DYNAMO::" + (now- last)); last= now;
        if(err) { context.fail("503::76JK_DELETE_ENTRY::UPDATE_TAG_INTO_DYNAMO::" + err.toString()); return; } 
        deleteEntryInS3(event, function(err, res) {
          now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("DELETE_ENTRY_IN_S3::" + (now- last)); last= now;
          if(err) { context.fail("504::76JK_DELETE_ENTRY::DELETE_ENTRY_IN_S3::" + err.toString()); return; }
          processGenerateStaticViaSNS(event, function(err, res) {
            now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("PROCESS_GENERATE_STATIC_VIA_SNS::" + (now- last)); last= now;
            if(err) { context.fail("505::76JK_DELETE_ENTRY::PROCESS_GENERATE_STATIC_VIA_SNS::" + err.toString()); return; }
            const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj); 
            context.succeed({ "response": true });
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
    "SET entries= :entries, " + 
		"lastModified= :lastModified";
	const expressionAttributeValues= {  
    ":entries": event.body.updatedEntries,
		":lastModified": event.body.now
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

const deleteEntryInS3= function(event, callback) {
  const params= {
    Bucket: "console.76jk.com",
    Key: "statics/images/" + event.body.tagId + "/" + event.body.entryId + ".jpeg"
  }
  s3.deleteObject(params, function(err, res) {
    err ? callback(err) : callback(null, res);
  });
};

const processGenerateStaticViaSNS= function(event, callback) {
  var msg= {}; msg.jk= event.body.jk; msg.tagId= event.body.tagId; msg.entryId= event.body.entryId;
  var message= JSON.stringify(msg);
  var topicArn= "arn:aws:sns:ap-southeast-1:847946740020:76JK_ProcessGenerateStatic";
  var params= { Message: message, TopicArn: topicArn }
  sns.publish(params, function(err, res) {
    err ? callback(err) : callback(null, res);
  });
}