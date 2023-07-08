require("dotenv").config()
require("./db/connection")
const express = require("express")
const app = express()
const cors = require("cors")
const {getTodaysData,getHighlights} = require("./controllers/bhavcopy.controller")
const routes = require("./routers/router")
const auth = require("./routers/auth.router")
const nse = require("nse_holidays")
const cron = require("cron").CronJob;
const sendActivityMail = require("./controllers/market_activity_letter")
require("./controllers/price_emitters")
require("./controllers/price_notification")
const puppeteer = require("./controllers/pupeteer.controller")
const AUTH = require("./controllers/auth.controller")
const userController = require("./controllers/user.controller")
// app.get("/",(req,res)=>{
//     const date = new Date()
//     const file = fs.createWriteStream("bhav.zip")
//     http.get(`https://www1.nseindia.com/content/historical/EQUITIES/2022/DEC/cm15DEC2022bhav.csv.zip`,(res)=>{
//         res.pipe(file)
//         file.on("finish",()=>{
//             console.log("Completed")
//             decompress("bhav.zip",'bhav').then((files)=>{
//                 console.log(files)
//                 console.log("extraction completed")
//             })
//         })
//     })
//     res.send("Completed")
// })
app.use(express.json())
app.use(cors())
app.use((req,res,next)=>{
    if(req.headers['authorization']?.split(" ").length > 1)
    res.setHeader("authorization", `Bearer ${req.headers['authorization'].split(" ")[1]}`)
    res.setHeader("access-control-expose-headers", "authorization")
    next()
})
app.use(express.static("priceAlertImages"))
app.use("/auth",auth)
app.use("/",AUTH.verify,routes)

const job = new cron("00 00 18 * * *",async function(){
    if(!await nse.isTodayHoliday()){
        console.log("inside holiday")
        let date = new Date()
        date = date.toDateString().split(" ")
        date = date[2]+"-"+date[1].toUpperCase()+"-"+date[3]
        getTodaysData(date)
        let highLightsDate = new Date().toJSON().split("T")[0].split("-").reverse()
        let highLightsYear  = highLightsDate.at(-1).slice(2)
        highLightsDate = highLightsDate[0]+highLightsDate[1]+highLightsYear
        getHighlights(highLightsDate)
    }
    console.log("called")
},null,true,"Asia/Kolkata")

const mailJob = new cron("00 30 18 * * *", function(){
    console.log("called mailer")
    sendActivityMail.main()
},null,true,"Asia/Kolkata")

const pingJob = new cron("*/5 * * * *", () => userController.Ping())

app.listen(process.env.PORT,(err)=>{
    if(err){
        console.log(err)
    }
    console.log(`Started listening on port ${process.env.PORT}`)
    job.start()
    mailJob.start()
    pingJob.start()
})
