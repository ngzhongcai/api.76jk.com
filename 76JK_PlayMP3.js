"use strict";
const SECRET= process.env.SECRET;
const aws= require("aws-sdk"); const jwt= require("jsonwebtoken"); 
var iotdata= new aws.IotData({ endpoint: "aur48b9xoo0gq-ats.iot.ap-southeast-1.amazonaws.com" });

exports.handler= function(event, context, callback) {
  console.log(event);
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  verify76JK(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("VERIFY_76JK::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_PLAY_MP3::VERIFY_76JK::" + err.toString()); return; }
    if(res.userId!== "487b429a-fdfe-4295-be74-f1c8a3f58284") { context.fail("501::76JK_PLAY_MP3::VERIFY_76JK::NO_ACCESS"); return; }
    event.jk= res;
    publishToDisplay(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("PUBLISH_TO_DISPLAY::" + (now- last)); last= now;
  		if(err) { context.fail("502::76JK_PLAY_MP3::PUBLISH_TO_DISPLAY::" + err.toString()); return; }
      var obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj);
      context.succeed({ "response": true });
    });
  });
}

const verify76JK= function(event, callback) {
  jwt.verify(event.body.jk, SECRET, function(err, res) {
    if(err && err.name=="TokenExpiredError") { callback(null, "TokenExpiredError"); return; }
    err ? callback(err) : callback(null, res);
  });
} 

var publishToDisplay= function(event, callback) {
  var obj= {}; obj.action= event.body.action; obj.clip= event.body.clip; var payload= JSON.stringify(obj);
  var params= { topic: "NGFAMILY/DISPLAY@NGFAMILY.COM", payload: payload, qos: 0 }
  iotdata.publish(params, function(err) {
    err ? callback(err) : callback();
  });
}
