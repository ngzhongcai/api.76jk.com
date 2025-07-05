// NOTE: FUNCTION TO BE CALLED MANUALLY BY ADMIN ONLY 
"use strict"; 
const aws= require("aws-sdk");
const s3= new aws.S3({ region: "ap-southeast-1" }); 
const sharp= require("sharp");

exports.handler= function(event, context, callback) {
  console.log(event);
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  downloadPhoto(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("DOWNLOAD_PHOTO::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_COMPRESS_PHOTO::DOWNLOAD_PHOTO::" + err.toString()); return; }
    event.body.photo= res; console.log("Downloaded: " + res.length);
    compressPhoto(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("COMPRESS_PHOTO::" + (now- last)); last= now;
      if(err) { context.fail("502::76JK_COMPRESS_PHOTO::COMPRESS_PHOTO::" + err.toString()); return; }
      event.body.compressed= res;
      uploadPhoto(event, function(err, res) {
        now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPLOAD_PHOTO::" + (now- last)); last= now;
        if(err) { context.fail("503::76JK_COMPRESS_PHOTO::UPLOAD_PHOTO::" + err.toString()); return; } 
        const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj);
        const response= { tagId: event.body.tagId, dynamic: "https://76jk.com/tag.html?tagId=" + event.body.tagId };
        context.succeed({ "response": response });
      });
    });
  });
}

const downloadPhoto= function(event, callback) {
  const params= {
    Bucket: "console.76jk.com",
    Key: event.body.key
  }
  s3.getObject(params, function(err, res) {
    err ? callback(err) : callback(null, res.Body);
  });
}

const compressPhoto= function(event, callback) {
  sharp(event.body.photo).rotate().resize(1080).jpeg({ quality: 80 }).toBuffer(function(err, res) {
    err ? callback(err) : callback(null, res);
  });
}

const uploadPhoto= function(event, callback) {
  const originalKey= event.body.key; // e.g. "statics/images/123/abc.jpeg"
  const lastSlashIndex= originalKey.lastIndexOf("/");
  const dirname= originalKey.substring(0, lastSlashIndex);    // "statics/images/123"
  const filename= originalKey.substring(lastSlashIndex + 1);  // "abc.jpeg"
  const compressedFilename= "COMPRESSED_" + filename;
  event.body.outputKey= dirname + "/" + compressedFilename;  

  const params= {
    Bucket: "console.76jk.com",
    Key: event.body.outputKey, 
    Body: event.body.compressed,
    ContentType: "image/jpeg"
  };
  s3.putObject(params, function(err, data) {
    err ? callback(err) : callback(null, data);
  });
}