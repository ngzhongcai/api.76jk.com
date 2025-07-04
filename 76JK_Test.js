// NOTE: FUNCTION TO BE CALLED MANUALLY BY ADMIN ONLY 
"use strict";
const SECRET= "cbebfd6c-84da-439b-853b-6a0a50b63edb";
const aws= require("aws-sdk");
const s3= new aws.S3({ region: "ap-southeast-1" });
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" });
const QRCodeCanvas= require("@loskir/styled-qr-code-node");

exports.handler= function(event, context, callback) {
  console.log(event); event.body= {};
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
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
}

const generateQR= async function(event, callback) {
  const qrCode= new QRCodeCanvas({
    data: "TEST TEST TEST",
    image: "https://76jk.com/images/logo.png"
  });
  const path= "/tmp/output.png";
  await qrCode.toFile(path, "png");
  fs.readFile(path, function(err, res) {
    err ? callback() : callback(null, res.toString("base64"));
  });
}

const uploadQR= function(event, callback) {
  const params= {
    Bucket: "console.76jk.com",
    Key: "statics/images/TEST/QR_TEST.png",
    Body: event.body.qr,
    ContentType: "image/png"
  }
  s3.putObject(params, function(err, res) {
    err ? callback(err) : callback(null, res);
  });
}