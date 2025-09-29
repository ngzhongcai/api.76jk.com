"use strict"; 
const SECRET= process.env.SECRET;
const aws= require("aws-sdk"); const jwt= require("jsonwebtoken");
var iotdata= new aws.IotData({ endpoint: "aur48b9xoo0gq-ats.iot.ap-southeast-1.amazonaws.com" });

exports.handler= function(event, context, callback) {
    console.log(event);
    const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
    verifyToken(event, function(err, res) {
        now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("VERIFY_TOKEN::" + (now- last)); last= now;
        if(err) { context.fail("501::76JK_DETECT_PERSON::VERIFY_TOKEN::" + err.toString()); return; }
        publishToDisplay(event, function(err, res) {
            now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("PUBLISH_TO_DISPLAY::" + (now- last)); last= now;
            if(err) { context.fail("501::76JK_DETECT_PERSON::PUBLISH_TO_DISPLAY::" + err.toString()); return; }
            const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj);
            const response= { tagId: event.body.tagId };
            context.succeed({ "response": response });
        });
    });
}

const verifyToken= function(event, callback) {
    const headers= event.headers || {};
    const authHeader= headers["authorization"] || headers["Authorization"] || "";
    if(!authHeader.startsWith("Bearer ")) { callback(null, "NOT_AUTHROIZED"); return; }
    const token= authHeader.substring("Bearer ".length);
    if(token!== process.env.SECRET) { callback(null, "NOT_AUTHORIZED!"); return; }
    callback();
}

var publishToDisplay= function(event, callback) {
    var obj= {}; obj.action= "human"; obj.view= "gate"; var payload= JSON.stringify(obj);
    var params= { topic: "NGFAMILY/DISPLAY@NGFAMILY.COM", payload: payload, qos: 0 }
    iotdata.publish(params, function(err) {
        err ? callback(err) : callback();
    });
}