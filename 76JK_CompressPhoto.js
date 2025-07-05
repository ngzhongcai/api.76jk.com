"use strict";
const SECRET= "cbebfd6c-84da-439b-853b-6a0a50b63edb";
const aws= require("aws-sdk"); const sharp= require("sharp");
const s3= new aws.S3({ region: "ap-southeast-1" }); 

exports.handler= function(event, context, callback) {
  event.body= JSON.parse(event.Records[0].Sns.Message); console.log(event.body);
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  downloadPhoto(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("DOWNLOAD_PHOTO::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_COMPRESS_PHOTO::DOWNLOAD_PHOTO::" + err.toString()); return; }
    event.body.photo= res;
    compressPhoto(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("COMPRESS_PHOTO::" + (now- last)); last= now;
      if(err) { context.fail("501::76JK_COMPRESS_PHOTO::COMPRESS_PHOTO::" + err.toString()); return; }
      event.body.compressed= res;
      uploadPhoto(event, function(err, res) {
        now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPLOAD_PHOTO::" + (now- last)); last= now;
        if(err) { context.fail("502::76JK_COMPRESS_PHOTO::UPLOAD_PHOTO::" + err.toString()); return; }
        const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj);
        context.succeed({ "response": res });
      });
    }); 
  });
}

const downloadPhoto= function(event, callback) {
  const params= {
    Bucket: "console.76jk.com",
    Key: "statics/images/" + event.body.tagId + "/ORIGINAL_" + event.body.entryId + ".jpeg"
  }
  s3.getObject(params, function(err, res) {
    err ? callback(err) : callback(res.Body);
  });
};


const compressPhoto= function(event, callback) {
  const base64String= decodeURIComponent(event.body.photo);
  event.body.buffer= Buffer.from(base64String, "base64");
  sharp(event.body.buffer).rotate().resize(1080).jpeg({ quality: 80 }).toBuffer(function(err, res) {
    err ? callback(err) : callback(null, res);
  });
}

const uploadPhoto= function(event, callback) { 
  const params= {
    Bucket: "console.76jk.com",
    Key: "statics/images/" + event.body.tagId + "/" + event.body.entryId + ".jpeg",
    Body: event.body.compressed,
    ContentType: "image/jpeg"
  };
  s3.putObject(params, function(err, data) {
    err ? callback(err) : callback(null, data);
  });
}

