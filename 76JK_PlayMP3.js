"use strict";
const SECRET= process.env.SECRET;
const aws= require("aws-sdk"); const jwt= require("jsonwebtoken"); 
var iotdata= new aws.IotData({ endpoint: "aur48b9xoo0gq-ats.iot.ap-southeast-1.amazonaws.com" });

exports.handler= function(event, context, callback) { 
  console.log(event); event.body= {}; const parts= event.path.split("/"); event.body.clip= parts[2]; event.body.where= parts[3];
  event.body.jk= getCookieValue(event.headers.Cookie, "jk");
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  verify76JK(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("VERIFY_76JK::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_PLAY_MP3::VERIFY_76JK::" + err.toString()); return; }
    event.body.isAuthorized= res.userId=== "487b429a-fdfe-4295-be74-f1c8a3f58284" ? true : false;
    event.jk= res;
    publishToDisplay(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("PUBLISH_TO_DISPLAY::" + (now- last)); last= now;
  		if(err) { context.fail("502::76JK_PLAY_MP3::PUBLISH_TO_DISPLAY::" + err.toString()); return; }
      generateResponse(event, function(err, res) {
        now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("GENERATE_RESPONSE::" + (now- last)); last= now;
        if(err) { context.fail("503::76JK_PLAY_MP3::GENERATE_RESPONSE::" + err.toString()); return; }
        const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj); 
        context.succeed(res);
      }); 
    });
  });
}

const getCookieValue= function(cookieString, name) {
  var pattern= new RegExp("(^|;\\s*)" + name + "=([^;]*)");
  var match= cookieString.match(pattern);
  return match ? match[2] : null;
};

const verify76JK= function(event, callback) {
  jwt.verify(event.body.jk, SECRET, function(err, res) {
    if(err && err.name=="TokenExpiredError") { callback(null, "TokenExpiredError"); return; }
    err ? callback(err) : callback(null, res);
  });
} 

const publishToDisplay= function(event, callback) {
  if(!event.body.isAuthorized) { callback(); return; }
  var obj= {}; obj.action= "playmp3"; obj.clip= event.body.clip; obj.where= event.body.where; var payload= JSON.stringify(obj);
  var params= { topic: "NGFAMILY/DISPLAY@NGFAMILY.COM", payload: payload, qos: 0 }
  iotdata.publish(params, function(err) {
    err ? callback(err) : callback();
  });
}

const generateResponse= function(event, callback) {
  var response= {}; response.statusCode= 302; response.headers= {};
  response.headers.Location= event.body.isAuthorized ? 
    "https://76jk.com/playing.html?clip=" + event.body.clip + "&where=" + event.body.where : "https://76jk.com";
  callback(null, response); return;
}