"use strict";
const SECRET= "930098a0-1efa-4cbf-b7b3-7471db09d1d7";
const aws= require("aws-sdk"); const jwt= require("jsonwebtoken"); const uuid= require("uuid");
const s3= new aws.S3({ region: "ap-southeast-1" });
const cloudfront= new aws.CloudFront({ region: "us-east-1" });

exports.handler= function(event, context, callback) {
  console.log(event);
  const timings= []; var timetaken= 0; var now= Math.round(new Date().getTime()); var last= Math.round(new Date().getTime()); event.body.now= now;
  verify76JK(event, function(err, res) {
    now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("VERIFY_76JK::" + (now- last)); last= now;
    if(err) { context.fail("501::76JK_GENERATE_STATIC::VERIFY_76JK::" + err.toString()); return; }
    event.jk= res; if(event.jk.redirect_uri) { context.fail("401::76JK_GENERATE_STATIC::NOT_ALLOWED"); return; }
    generateStatic(event, function(err, res) {
      now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("GENERATE_STATIC::" + (now- last)); last= now;
      if(err) { context.fail("502::76JK_GENERATE_STATIC::GENERATE_STATIC::" + err.toString()); return; }
      uploadStatic(event, function(err, res) {
        now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("UPLOAD_STATIC::" + (now- last)); last= now;
        if(err) { context.fail("503::76JK_GENERATE_STATIC::UPLOAD_STATIC::" + err.toString()); return; }
        createInvalidation(event, function(err, res) {
          now= Math.round(new Date().getTime()); timetaken= timetaken+ now- last; timings.push("CREATE_INVALIDATION::" + (now- last)); last= now;
          if(err) { context.fail("504::76JK_GENERATE_STATIC::CREATE_INVALIDATION::" + err.toString()); return; }
          const obj= {}; obj.timings= timings; obj.timetaken= timetaken; console.log(obj); 
          context.succeed({ "response": res });
        });
      });
    });
  });
}

const verify76JK= function(event, callback) {
  jwt.verify(event.body.jk, SECRET, function(err, res) {
    if(err && err.name=="TokenExpiredError") { callback(null, "TokenExpiredError"); return; }
    err ? callback(err) : callback(null, res);
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
  await page.goto("https://76jk.com/index.html");
  await page.waitForSelector("#login-email"); 
  await page.type("#login-email", "ngzhongcai@digitively.com");
  await page.type("#login-password", "Gjw7vda9");
  await page.click("#login-btn");
  await page.waitForSelector("#bonsais", { visible: true });
  await page.goto("https://76jk.com/bonsai.html?bonsaiId=" + event.body.bonsaiId);
  await page.waitForSelector("#h1Actions", { visible: true });
  event.body.html= await page.content();
  await browser.close();
  callback();
};

const uploadStatic= function(event, callback) {
  var params= {
    Bucket: "console.76jk.com",
    Key: "statics/" + event.body.bonsaiId + ".html",
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
    DistributionId: "E3TR2Y8CQMMHCY",
    InvalidationBatch: {
      CallerReference: uuid.v4(),
      Paths: { Quantity: 1, Items: ["/*"] }
    }
  }
  cloudfront.createInvalidation(params, function(err, res) {
    err ? callback(err) : callback(null, res);
  });
}