const {queue} = require("async")
const client = require("../db/connection")
const { ObjectID } = require("bson")
const db = client.db("bhav")
const {createImage} = require("./image.service")
const pug = require("pug")
const PriceAlertQueue = queue(PriceAlert,5)
const {transporter} = require("../mailer/mailer")

async function PriceAlert(id,callback){
    try{
        let alert = await CreateImage(id)
        if(alert?.DELETED || alert?.COMPLETED){
            return
        }
        await db.collection("PriceAlerts").updateOne({_id: new ObjectID(id)},{$set:{COMPLETED:true,COMPLETEDTIMESTAMP: new Date()}})
    }catch(err){
        console.log(err)
    }
}

async function CreateImage(id){
    let alert = await db.collection("PriceAlerts").findOne({_id: new ObjectID(id)})
    let data = await getStockData(alert)
    let parseData = await ParseStockData(data)
    let bg = 'green'
    if(data[data.length-1].CLOSE < data[0].CLOSE){
        bg = 'red'
    }
    let fileName = await createImage(id,{xAxis:parseData.xAxis,yAxis:parseData.yAxis,bg:bg})
    let templateData = {
        SYMBOL: data[0].SYMBOL,
        CLOSE: data[data.length-1].CLOSE,
        img: `http://127.0.0.1:3000/${fileName}`
    }
    sendMail({stock:templateData,to:alert.MAILTO})
}

async function getStockData(alert){
    let getDuration = GetDuration(alert)
    let data = await db.collection(alert.SYMBOL).find({$and:[{TIMESTAMP:{$gte: getDuration}},{TIMESTAMP:{$lte: new Date()}}]},{sort:{"TIMESTAMP":1}}).toArray()
    return data
}

function GetDuration(alert){
    let timeGap = (Date.now() - Date.parse(alert.TIMESTAMP)) / 86400000
    let duration = alert.TIMESTAMP 
    if(timeGap < parseInt(process.env.PRICE_ALERT_CHART_DURATION)){
        duration = new Date(Date.parse(alert.TIMESTAMP) - ((parseInt(process.env.PRICE_ALERT_CHART_DURATION) - timeGap)*86400000))
    }
    return duration
}

async function getAlert(id){
    let alert = await db.collection("PriceAlerts").findOne({_id: new ObjectID(id)})
    return alert
}

async function ParseStockData(data){
    let xAxis = await Promise.all(
        data.map((ele)=>{
            let date = a = new Date(ele.TIMESTAMP).toLocaleDateString().split("/")
            return date[1] + "-" + date[0] + "-" + date[2]    
        })
    )

    let yAxis = await Promise.all(
        data.map((ele)=>{
            return ele.CLOSE
        })
    )

    return {xAxis,yAxis}

}



function sendMail(data){
    let html = pug.renderFile("./templates/price_notification.pug",data)
    console.log(html)
    let mailOptions = {
        from: 'experimental.vilas@gmail.com',
        to: data.to || 'vvilas122@gmail.com',
        subject: 'Price Alert',
        text: 'Alert triggered',
        html: html
    }
    transporter.sendMail(mailOptions,(err,info)=>{
        if(err){
            console.log(err)
        }else{
            console.log(info)
        }
    })
}

module.exports = {
    PriceAlertQueue
}