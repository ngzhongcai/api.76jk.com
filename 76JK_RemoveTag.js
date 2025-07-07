// NOTE: FUNCTION TO BE CALLED MANUALLY BY ADMIN ONLY 
"use strict";
const SECRET= "cbebfd6c-84da-439b-853b-6a0a50b63edb";
const aws= require("aws-sdk");
const s3= new aws.S3({ region: "ap-southeast-1" });
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" });

exports.handler= function(event, context, callback) {
  console.log(event);
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  deleteTagFromDynamo(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPDATE_TAG_FROM_DYNAMO::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_REMOVE_TAG::UPDATE_TAG_FROM_DYNAMO::" + err.toString()); return; }
    event.body.userId= res.userId;
    getUserFromDynamo(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("GET_USER_FROM_DYNAMO::" + (now- last)); last= now;
      if(err) { context.fail("502::76JK_REMOVE_TAG::GET_USER_FROM_DYNAMO::" + err.toString()); return; }
      event.body.updatedTags= res.tags.filter(function(tagId) { return tagId!== event.body.tagId; });
      updateUserIntoDynamo(event, function(err, res) {
        now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPDATE_USER_INTO_DYNAMO::" + (now- last)); last= now;
        if(err) { context.fail("503::76JK_REMOVE_TAG::UPDATE_USER_INTO_DYNAMO::" + err.toString()); return; } 
        listFilesInFolderS3(event, function(err, res) {
          now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("LIST_FILES_FOLDER_S3::" + (now- last)); last= now;
          if(err) { context.fail("504::76JK_REMOVE_TAG::LIST_FILES_FOLDER_S3::" + err.toString()); return; }
          deleteFilesInS3(event, function(err, res) {
            now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("DELETE_FILES_IN_S3::" + (now- last)); last= now;
            if(err) { context.fail("505::76JK_REMOVE_TAG::DELETE_FILES_IN_S3::" + err.toString()); return; }
            const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj); 
            context.succeed({ "response": true });
          });
        });
      });
    });
  });
}

const deleteTagFromDynamo= function(event, callback) {
  const params= {
    TableName: "76JK-TAGS",
    Key: { "tagId": event.body.tagId },
    ReturnValues: "ALL_OLD"
  }
  ddc.delete(params, function(err, res) {
    err ? callback(err) : callback(null, res.Attributes);
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
  const updateExpression=
    "SET tags= :tags, " + 
		"lastModified= :lastModified";
	const expressionAttributeValues= {  
    ":tags": event.body.updatedTags,
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

const listFilesInFolderS3= function(event, callback) {
  const params= {
    Bucket: "console.76jk.com",
    Prefix: "statics/images/" + event.body.tagId + "/"
  }
  s3.listObjectsV2(params, function(err, res) {
    if(err) { callback(err); return; }
    event.body.deleteList= res.Contents.map(function(obj) { return { Key: obj.Key }; }); 
    event.body.deleteList.push({ Key: "statics/" + event.body.tagId + ".html" });
    callback(); 
  });
};

const deleteFilesInS3= function(event, callback) {
  const params= {
    Bucket: "console.76jk.com",
    Delete: { Objects: event.body.deleteList }
  };
  s3.deleteObjects(params, function(err, res) {
    err ? callback(err) : callback();
  });
}