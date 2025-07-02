"use strict";
const SECRET= "930098a0-1efa-4cbf-b7b3-7471db09d1d7";
const aws= require("aws-sdk"); const jwt= require("jsonwebtoken");
const s3= new aws.S3({ region: "ap-southeast-1" });
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" });
var lambda= new aws.Lambda({ region: "ap-southeast-1" });
const uuid= require("uuid"); const qrcode= require("qrcode");

exports.handler= function(event, context, callback) {
  console.log(event); event.body.flowerId= uuid.v4();
	const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  verifyFlowers(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("VERIFY_FLOWERS::" + (now- last)); last= now;
		if(err) { context.fail("501::FLOWERS_NEW_FLOWER::VERIFY_FLOWERS::" + err.toString()); return; }
		event.flowers= res; if(event.flowers.redirect_uri) { context.fail("401::FLOWERS_NEW_FLOWER::NOT_ALLOWED"); return; }
    updateFlowerIntoDynamo(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPDATE_FLOWER_INTO_DYNAMO::" + (now- last)); last= now;
      if(err) { context.fail("502::FLOWERS_NEW_FLOWER::UPDATE_FLOWER_INTO_DYNAMO::" + err.toString()); return; }
      generateQR(event, function(err, res) {
        now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("GENERATE_QR::" + (now- last)); last= now;
        if(err) { context.fail("504::FLOWERS_NEW_FLOWER::GENERATE_QR::" + err.toString()); return; } 
        event.body.qr= res;
        uploadQR(event, function(err, res) {
          now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPLOAD_QR::" + (now- last)); last= now;
          if(err) { context.fail("505::FLOWERS_NEW_FLOWER::UPLOAD_QR::" + err.toString()); return; }
          invokeCreateEntry(event, function(err, res) {
            now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("INVOKE_CREATE_ENTRY::" + (now- last)); last= now;
            if(err) { context.fail("503::FLOWERS_NEW_FLOWER::INVOKE_CREATE_ENTRY::" + err.toString()); return; }
            const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj);
            const response= { flowerId: event.body.flowerId };
            context.succeed({ "response": response });
          });
        });
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
    "SET name_= :name_, " + 
    "firstCreated= :firstCreated, " + 
    "lastUpdated= :lastUpdated, " +
    "entries= :entries";
	const expressionAttributeValues= {
    ":name_": event.body.name,
    ":firstCreated": event.body.now, 
    ":lastUpdated": event.body.now,
    ":entries": []
	}
	const params= {
		TableName: "FLOWERS-76JK",
    Key: { "flowerId": event.body.flowerId },
		UpdateExpression: updateExpression,
		ExpressionAttributeValues: expressionAttributeValues,
		ReturnValues: "ALL_NEW"
	}
	ddc.update(params, function(err, res) {
		err ? callback(err) : callback(null, res.Attributes);
	});
}

const generateQR= function(event, callback) {
  const url= "https://flowers.digitively.com/" + event.body.flowerId + ".html";
  qrcode.toBuffer(url, function(err, res) { 
    err ? callback(err) : callback(null, res);
  });
}

const uploadQR= function(event, callback) {
  const params= {
    Bucket: "flowers.76JK.COM",
    Key: "images/" + event.body.flowerId + "/" + "QR_" + event.body.flowerId + ".png",
    Body: event.body.qr,
    ContentType: "image/png"
  }
  s3.putObject(params, function(err, res) {
    err ? callback(err) : callback(null, res);
  });
}

const invokeCreateEntry= function(event, callback) {
  const params= {
		FunctionName: "FLOWERS_NewEntry",
		Payload: JSON.stringify(event)
  }
  lambda.invoke(params, function(err, res) {
    if(err) { callback(err); return; }
    var payload= JSON.parse(res.Payload);
    if(payload.errorMessage) { callback(payload.errorMessage); return; }
    callback(null, payload);
  });
}