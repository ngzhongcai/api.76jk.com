"use strict";
const SECRET= "cbebfd6c-84da-439b-853b-6a0a50b63edb";
const aws= require("aws-sdk");
const ddc= new aws.DynamoDB.DocumentClient({ region: "ap-southeast-1" });

exports.handler= function(event, context, callback) {
  console.log(event); event.body= {}; const parts= event.path.split("/"); event.body.userId= parts[2]; event.body.token= parts[3];
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;

  const response= {
    statusCode: 302, 
    headers: { Location: "https://lazada.com" }
  };

  context.succeed(response);
}