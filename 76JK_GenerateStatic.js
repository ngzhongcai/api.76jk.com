"use strict";
const SECRET= "cbebfd6c-84da-439b-853b-6a0a50b63edb";
const aws= require("aws-sdk");
const s3= new aws.S3({ region: "ap-southeast-1" });
const cloudfront= new aws.CloudFront({ region: "us-east-1" });

exports.handler= function(event, context, callback) {
  event.body= JSON.parse(event.Records[0].Sns.Message); console.log(event.body);
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  generateStatic(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("GENERATE_STATIC::" + (now- last)); last= now;
    if(err) { context.fail("504::76JK_GENERATE_STATIC::GENERATE_STATIC::" + err.toString()); return; }
    uploadStatic(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPLOAD_STATIC::" + (now- last)); last= now;
      if(err) { context.fail("505::76JK_GENERATE_STATIC::UPLOAD_STATIC::" + err.toString()); return; }
      createInvalidation(event, function(err, res) {
        now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("CREATE_INVALIDATION::" + (now- last)); last= now;
        if(err) { context.fail("506::76JK_GENERATE_STATIC::CREATE_INVALIDATION::" + err.toString()); return; }
        const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj);
        context.succeed({ "response": res });
      });
    });
  });
}  

const generateStatic= async function(event, callback) {
  const chromiumModule= await import("@sparticuz/chromium");
  const chromium= chromiumModule.default;
  const puppeteerModule= await import("puppeteer-core");
  const puppeteer= puppeteerModule.default;
  
  const browser= await puppeteer.launch({
    args: puppeteer.defaultArgs({ args: chromium.args, headless: "shell" }),
    executablePath: await chromium.executablePath(),
    headless: "shell",
  });
  const page= await browser.newPage(); 
  await page.setCookie({ name: "jk", value: event.body.jk, domain: "76jk.com", path: "/" });
  await page.goto("https://76jk.com/tag.html?tagId=" + event.body.tagId, { waitUntil: "networkidle0" });
  await page.waitForSelector("#h1Actions", { visible: true });
  await page.evaluate(function() {
    document.querySelectorAll("[data-admin='true']").forEach(function(el) {
      el.remove();
    });
  });
  event.body.html= await page.content();
  await browser.close();
  callback();
}; 

const uploadStatic= function(event, callback) {
  const params= {
    Bucket: "console.76jk.com",
    Key: "statics/" + event.body.tagId + ".html",
    Body: event.body.html,
    ContentType: "text/html",
    ContentDisposition: "inline"  
  };
  s3.upload(params, function(err, res) {
    err ? callback(err) : callback(null, res);
  });
}

const createInvalidation= function(event, callback) {
  const params= {
    DistributionId: "EWH66K8CF2UI2",
    InvalidationBatch: {
      CallerReference: event.body.now.toString(),
      Paths: { Quantity: 1, Items: ["/*"] }
    }
  }
  cloudfront.createInvalidation(params, function(err, res) {
    err ? callback(err) : callback(null, res);
  });
}