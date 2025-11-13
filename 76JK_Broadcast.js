"use strict";
const SECRET= process.env.SECRET;
const aws= require("aws-sdk"); const jwt= require("jsonwebtoken"); 
var iotdata= new aws.IotData({ endpoint: "aur48b9xoo0gq-ats.iot.ap-southeast-1.amazonaws.com" });

exports.handler= function(event, context, callback) {
	console.log(event);
	const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
	verify76JK(event, function(err, res) {
		now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("VERIFY_76JK::" + (now- last)); last= now;
		if(err) { context.fail("501::76JK_BROADCAST::VERIFY_76JK::" + err.toString()); return; }
		event.body.isAuthorized= res.userId=== "487b429a-fdfe-4295-be74-f1c8a3f58284" ? true : false;
		event.jk= res;
		publishBroadcast(event, function(err, res) {
			now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("GENERATE_RESPONSE::" + (now- last)); last= now;
			if(err) { context.fail("502::76JK_BROADCAST::GENERATE_RESPONSE::" + err.toString()); return; }
			const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj); 
			context.succeed(res);
		});
	});
} 

const verify76JK= function(event, callback) {
	jwt.verify(event.body.jk, SECRET, function(err, res) {
		if(err && err.name=="TokenExpiredError") { callback(null, "TokenExpiredError"); return; }
		err ? callback(err) : callback(null, res);
	});
} 

const TOPIC_MAP= {
	gate: "NGFAMILY/GATE@NGFAMILY.COM",
	display: "NGFAMILY/DISPLAY@NGFAMILY.COM",
	speaker: "NGFAMILY/SPEAKER@NGFAMILY.COM"
};

const publishBroadcast= function(event, callback) {
	if(!event.body.isAuthorized) { callback(); return; }
	var where= event.body.where || "";
	var targets= where.split(",").map(function(loc) { return loc.trim().toLowerCase(); }).filter(function(loc) { return !!loc; });
	var uniqueTargets= Array.from(new Set(targets));
	var topics= uniqueTargets.map(function(loc) { return TOPIC_MAP[loc]; }).filter(function(topic) { return !!topic; });
	if(!topics.length) { callback("NO_VALID_TARGETS"); return; }
	var payloadObj= {}; payloadObj.text= event.body.text || ""; payloadObj.voice= event.body.voice || ""; payloadObj.action= "broadcast";
	var payload= JSON.stringify(payloadObj); var qos= 0;
	var responses= [];
	var publishNext= function(index) {
		if(index>= topics.length) { callback(null, { published: responses }); return; }
		var params= { topic: topics[index], payload: payload, qos: qos };
		iotdata.publish(params, function(err) {
			if(err) { callback(err); return; }
			responses.push(params.topic);
			publishNext(index+ 1);
		});
	};
	publishNext(0);
}
