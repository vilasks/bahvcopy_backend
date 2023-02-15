require("dotenv").config()
require("./db/connection")
const express = require("express")
const app = express()
const cors = require("cors")
// const http = require("https")
// const fs = require("fs")
// const decompress = require("decompress")
const {getTodaysData,getHighlights} = require("./controllers/bhavcopy.controller")
const routes = require("./routers/router")
const nse = require("nse_holidays")
const cron = require("cron").CronJob;

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

app.use(cors())
app.use("/",routes)
// setTimeout(async()=>{
//     // let today = Date.now()
//     // let past = 1673461800000
//     // while(past<today){
//     //     let date = new Date(past)
//     //     if(date.getDay()==0 || date.getDay()==6){
//     //         console.log("Weekend")
//     //     }else{
//     //         date = date.toDateString().split(" ")
//     //         date = date[2]+"-"+date[1].toUpperCase()+"-"+date[3]
//     //         await getTodaysData(date)
//     //     }
//     //     past+=86400000
//     // }
//     await getTodaysData("10-JAN-2023")
// },3000)

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
})

// setTimeout(async()=>{
//     let highLightsDate = new Date().toJSON().split("T")[0].split("-").reverse()
//     let highLightsYear  = highLightsDate.at(-1).slice(2)
//     highLightsDate = highLightsDate[0]+highLightsDate[1]+highLightsYear
//     let some = await getHighlights("100223") 
//     console.log("Done")
// })

app.listen(process.env.PORT,(err)=>{
    if(err){
        console.log(err)
    }
    console.log(`Started listening on port ${process.env.PORT}`)
    job.start()
})