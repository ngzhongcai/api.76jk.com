"use strict";
const SECRET= "930098a0-1efa-4cbf-b7b3-7471db09d1d7";
const aws= require("aws-sdk"); const jwt= require("jsonwebtoken"); 
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" });

exports.handler= function(event, context, callback) {
  console.log(event);
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  verify76JK(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("VERIFY_76JK::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_GET_BONSAI::VERIFY_76JK::" + err.toString()); return; }
    event.jk= res; if(event.jk.redirect_uri) { context.fail("401::76JK_GET_BONSAI::NOT_ALLOWED"); return; }
    getBonsaiFromDynamo(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("GET_BONSAI_FROM_DYNAMO::" + (now- last)); last= now;
      if(err) { context.fail("502::76JK_GET_BONSAI::GET_BONSAI_FROM_DYNAMO::" + err.toString()); return; }
      const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj); 
      context.succeed({ "response": res });
    });
  });
}

const verify76JK= function(event, callback) {
  jwt.verify(event.body.jk, SECRET, function(err, res) {
    if(err && err.name=="TokenExpiredError") { callback(null, "TokenExpiredError"); return; }
    err ? callback(err) : callback(null, res);
  });
}

const getBonsaiFromDynamo= function(event, callback) {
	const params= {
		TableName: "BONSAIS-76JK", ConsistentRead: true,
		Key: { "bonsaiId": event.body.bonsaiId }
	}
	ddc.get(params, function(err, res) {
		err ? callback(err) : callback(null, res.Item);
	});
}
