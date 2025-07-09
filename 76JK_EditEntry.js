"use strict";
const SECRET= "cbebfd6c-84da-439b-853b-6a0a50b63edb";
const aws= require("aws-sdk"); const jwt= require("jsonwebtoken"); const uuid= require("uuid"); 
const s3= new aws.S3({ region: "ap-southeast-1" });
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" });
const sns= new aws.SNS({ region: "ap-southeast-1" }); 

exports.handler= function(event, context, callback) {
  console.log(event);
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  verify76JK(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("VERIFY_76JK::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_EDIT_ENTRY::VERIFY_76JK::" + err.toString()); return; }
    event.jk= res;
    getTagFromDynamo(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("GET_TAG_FROM_DYNAMO::" + (now- last)); last= now;
      if(err) { context.fail("502::76JK_EDIT_ENTRY::GET_TAG_FROM_DYNAMO::" + err.toString()); return; }
      if(res.userId!= event.jk.userId) { context.fail("401::76JK_EDIT_ENTRY::NO_ACCESS"); return; }
      event.body.tag= res;
      event.body.entryIndex= event.body.tag.entries.findIndex(function(e) { return e.entryId=== event.body.entryId; });
      if(event.body.entryIndex=== -1) { context.fail("402::76JK_EDIT_ENTRY::NO_ACCESS"); return; }
      updateTagIntoDynamo(event, function(err, res) {
        now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPDATE_TAG_INTO_DYNAMO::" + (now- last)); last= now;
        if(err) { context.fail("503::76JK_EDIT_ENTRY::UPDATE_TAG_INTO_DYNAMO::" + err.toString()); return; }
        event.body.buffer= Buffer.from(decodeURIComponent(event.body.photo), "base64");
        uploadPhotoToS3(event, function(err, res) {
          now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPLOAD_PHOTO_TO_S3::" + (now- last)); last= now;
          if(err) { context.fail("505::76JK_EDIT_ENTRY::UPLOAD_PHOTO_TO_S3::" + err.toString()); return; }
          processGenerateStaticViaSNS(event, function(err, res) {
            now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("PROCESS_GENERATE_STATIC_VIA_SNS::" + (now- last)); last= now;
            if(err) { context.fail("506::76JK_EDIT_ENTRY::PROCESS_GENERATE_STATIC_VIA_SNS::" + err.toString()); return; }
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
  event.body.tag.entries[event.body.entryIndex]= {
    entryId: event.body.entryId,
    description: decodeURIComponent(event.body.description),
    firstCreated: parseInt(event.body.time) * 1000,
    lastModified: event.body.now
  }

  const updateExpression=
    "SET entries= :entries";
  const expressionAttributeValues= {     
    ":entries": event.body.tag.entries 
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

const uploadPhotoToS3= function(event, callback) {  
  const params= {
    Bucket: "console.76jk.com",
    Key: "statics/images/" + event.body.tagId + "/" + event.body.entryId + ".jpeg",
    Body: event.body.buffer,
    ContentType: "image/jpeg"
  };
  s3.putObject(params, function(err, data) {
    err ? callback(err) : callback(null, data);
  });
}

const processGenerateStaticViaSNS= function(event, callback) {
  var msg= {}; msg.jk= event.body.jk; msg.tagId= event.body.tagId; msg.entryId= event.body.entryId;
  var message= JSON.stringify(msg);
  var topicArn= "arn:aws:sns:ap-southeast-1:847946740020:76JK_ProcessGenerateStatic";
  var params= { Message: message, TopicArn: topicArn }
  sns.publish(params, function(err, res) {
    err ? callback(err) : callback(null, res);
  });
}