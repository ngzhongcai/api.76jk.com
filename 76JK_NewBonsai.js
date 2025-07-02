"use strict";
const SECRET= "cbebfd6c-84da-439b-853b-6a0a50b63edb";
const aws= require("aws-sdk"); const jwt= require("jsonwebtoken");
const s3= new aws.S3({ region: "ap-southeast-1" });
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" });
var lambda= new aws.Lambda({ region: "ap-southeast-1" });
const uuid= require("uuid"); const qrcode= require("qrcode");

exports.handler= function(event, context, callback) {
  console.log(event); event.body.bonsaiId= uuid.v4();
	const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  verify76JK(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("VERIFY_76JK::" + (now- last)); last= now;
		if(err) { context.fail("501::76JK_NEW_BONSAI::VERIFY_76JK::" + err.toString()); return; }
		event.jk= res; if(event.jk.redirect_uri) { context.fail("401::76JK_NEW_BONSAI::NOT_ALLOWED"); return; }
    updateBonsaiIntoDynamo(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPDATE_BONSAI_INTO_DYNAMO::" + (now- last)); last= now;
      if(err) { context.fail("502::76JK_NEW_BONSAI::UPDATE_BONSAI_INTO_DYNAMO::" + err.toString()); return; }
      generateQR(event, function(err, res) {
        now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("GENERATE_QR::" + (now- last)); last= now;
        if(err) { context.fail("504::76JK_NEW_BONSAI::GENERATE_QR::" + err.toString()); return; } 
        event.body.qr= res;
        uploadQR(event, function(err, res) {
          now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPLOAD_QR::" + (now- last)); last= now;
          if(err) { context.fail("505::76JK_NEW_BONSAI::UPLOAD_QR::" + err.toString()); return; }
          invokeCreateEntry(event, function(err, res) {
            now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("INVOKE_CREATE_ENTRY::" + (now- last)); last= now;
            if(err) { context.fail("503::76JK_NEW_BONSAI::INVOKE_CREATE_ENTRY::" + err.toString()); return; }
            const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj);
            const response= { bonsaiId: event.body.bonsaiId };
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

const updateBonsaiIntoDynamo= function(event, callback) {
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
		TableName: "BONSAIS-76JK",
    Key: { "bonsaiId": event.body.bonsaiId },
		UpdateExpression: updateExpression,
		ExpressionAttributeValues: expressionAttributeValues,
		ReturnValues: "ALL_NEW"
	}
	ddc.update(params, function(err, res) {
		err ? callback(err) : callback(null, res.Attributes);
	});
}

const generateQR= function(event, callback) {
  const url= "https://76jk.com/" + event.body.bonsaiId + ".html";
  qrcode.toBuffer(url, function(err, res) { 
    err ? callback(err) : callback(null, res);
  });
}

const uploadQR= function(event, callback) {
  const params= {
    Bucket: "console.76jk.com",
    Key: "images/" + event.body.bonsaiId + "/" + "QR_" + event.body.bonsaiId + ".png",
    Body: event.body.qr,
    ContentType: "image/png"
  }
  s3.putObject(params, function(err, res) {
    err ? callback(err) : callback(null, res);
  });
}

const invokeCreateEntry= function(event, callback) {
  const params= {
		FunctionName: "76JK_NewEntry",
		Payload: JSON.stringify(event)
  }
  lambda.invoke(params, function(err, res) {
    if(err) { callback(err); return; }
    var payload= JSON.parse(res.Payload);
    if(payload.errorMessage) { callback(payload.errorMessage); return; }
    callback(null, payload);
  });
}