// NOTE: FUNCTION TO BE CALLED MANUALLY BY ADMIN ONLY
// NOTE: NO NEED TO CREATE AND UPLOAD QR CODE. THIS IS A SECURITY RISK
"use strict";
const SECRET= "cbebfd6c-84da-439b-853b-6a0a50b63edb";
const aws= require("aws-sdk");
const s3= new aws.S3({ region: "ap-southeast-1" });
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" }); 
const uuid= require("uuid"); const qrcode= require("qrcode");

exports.handler= function(event, context, callback) {
  console.log(event); event.body= {}; event.body.tagId= uuid.v4();
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  updateTagIntoDynamo(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPDATE_TAG_INTO_DYNAMO::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_NEW_TAG::UPDATE_TAG_INTO_DYNAMO::" + err.toString()); return; } 
    generateQR(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("GENERATE_QR::" + (now- last)); last= now;
      if(err) { context.fail("502::76JK_NEW_TAG::GENERATE_QR::" + err.toString()); return; } 
      event.body.qr= res;
      uploadQR(event, function(err, res) {
        now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPLOAD_QR::" + (now- last)); last= now;
        if(err) { context.fail("503::76JK_NEW_TAG::UPLOAD_QR::" + err.toString()); return; } 
        const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj);
        const response= { tagId: event.body.tagId, dynamic: "https://76jk.com/tag.html?tagId=" + event.body.tagId };
        context.succeed({ "response": response });
      });
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

const generateQR= function(event, callback) {
  const url= "https://76jk.com/statics/" + event.body.tagId + ".html";
  qrcode.toBuffer(url, function(err, res) { 
    err ? callback(err) : callback(null, res);
  });
}

const uploadQR= function(event, callback) {
  const params= {
    Bucket: "console.76jk.com",
    Key: "statics/images/" + "QR_" + event.body.tagId + ".png",
    Body: event.body.qr,
    ContentType: "image/png"
  }
  s3.putObject(params, function(err, res) {
    err ? callback(err) : callback(null, res);
  });
}