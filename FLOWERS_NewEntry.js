"use strict";
const SECRET= "930098a0-1efa-4cbf-b7b3-7471db09d1d7";
const aws= require("aws-sdk"); const jwt= require("jsonwebtoken");
const s3= new aws.S3({ region: "ap-southeast-1" });
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" }); 
const uuid= require("uuid");

exports.handler= function(event, context, callback) {
  console.log(event); event.body.entryId= uuid.v4();
	const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  verifyFlowers(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("VERIFY_FLOWERS::" + (now- last)); last= now;
		if(err) { context.fail("501::FLOWERS_NEW_ENTRY::VERIFY_FLOWERS::" + err.toString()); return; }
		event.flowers= res; if(event.flowers.redirect_uri) { context.fail("401::FLOWERS_NEW_ENTRY::NOT_ALLOWED"); return; }
    updateFlowerIntoDynamo(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPDATE_FLOWER_INTO_DYNAMO::" + (now- last)); last= now;
      if(err) { context.fail("502::FLOWERS_NEW_ENTRY::UPDATE_FLOWER_INTO_DYNAMO::" + err.toString()); return; }
      uploadPicture(event, function() {
        now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPLOAD_PICTURE::" + (now- last)); last= now;
        if(err) { context.fail("503::FLOWERS_NEW_ENTRY::UPLOAD_PICTURE::" + err.toString()); return; }
        const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj);
        const response= { flowerId: event.body.flowerId };
        context.succeed({ "response": response });
      });
    });
  });
}

const verifyFlowers= function(event, callback) {
	jwt.verify(event.body.flowers, SECRET, function(err, res) {
    if(err && err.name=="TokenExpiredError") { callback(null, "TokenExpiredError"); return; }
    err ? callback(err) : callback(null, res);
  });
}

const updateFlowerIntoDynamo= function(event, callback) {
  const updateExpression=
    "SET entries= list_append(entries, :entry)";
	const expressionAttributeValues= {     
    ":entry": [{
      "entryId": event.body.entryId,
      "isPicture": event.body.picture ? true : false,
      "description": decodeURIComponent(event.body.description),
      "firstCreated": event.body.now,
      "lastUpdated": event.body.now
    }]
	}
	const params= {
		TableName: "FLOWERS-76JK",
    Key: { "flowerId": event.body.flowerId },
		UpdateExpression: updateExpression,
		ExpressionAttributeValues: expressionAttributeValues,
		ReturnValues: "UPDATED_NEW"
	}
	ddc.update(params, function(err, res) {
		err ? callback(err) : callback(null, res.Attributes);
	});
}

const uploadPicture= function(event, callback) {
  if(!event.body.picture) { callback(); return; }
  const base64String= decodeURIComponent(event.body.picture);
  const buffer= Buffer.from(base64String, "base64");
  const params= {
    Bucket: "flowers.76JK.COM",
    Key: "images/" + event.body.flowerId + "/" + event.body.entryId + ".jpeg",
    Body: buffer,
    ContentType: "image/jpeg"
  }
  s3.putObject(params, function(err, res) {
    err ? callback(err) : callback(null, res);
  });
} 