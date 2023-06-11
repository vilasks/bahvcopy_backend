const https = require("https")
const fs = require("fs")
const decompress = require("decompress")
const csv = require("csv-parser")
const client = require("../db/connection")
const db = client.db("bhav")
const {ResCode} = require("../models/response.codes")
const {priceNotifier} = require("./price_emitters")
const { PriceAlertQueue} = require("./price_notification")
const { ObjectId } = require("mongodb")
const puppeteer = require("./pupeteer.controller")
const {transporter} = require("../mailer/mailer")

const bitesFrame = [
    {label:"52Weeks",timeFrame:86400000*365},
    {label:"4Weeks",timeFrame:86400000*30},
    {label:"1Week",timeFrame:86400000*7}
]
exports.hasSymbol = async(symbol) => {
    try{
        let data = (await db.collections()).map((e)=>{
            return e.namespace.split(".")[1]
        }).filter((e)=>{
            return e == symbol
        })

        if(data.length<=0){
            return false
        }
        return true
    }catch(err){
        console.log(err)
        return false;
    }
}

exports.getTodaysData = async(date,tries=0) => {
    try{
        const file = fs.createWriteStream("./bhav.zip")
        let parts = date.split("-")
        let full_data = date.split("-").join("")
        // https://archives.nseindia.com/content/historical/EQUITIES/2023/APR/cm12APR2023bhav.csv.zip
        let url = `https://archives.nseindia.com/content/historical/EQUITIES/${parts[2]}/${parts[1]}/cm${full_data}bhav.csv.zip`
        let checker = await new Promise((resolve,rejects)=>{
            https.get(url,{
                headers:{
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.1 Safari/605.1.15",
                    "Referer": "http://www.google.com/",
                    "cookie": "NSE-TEST-1=1960845322.20480.0000; path=/"
                }
            },(response)=>{
                console.log(response.statusCode)
                if(response.statusCode!=200){
                    return rejects(null)
                }
                response.pipe(file)
                response.on("data",()=>console.log("Data"))
                response.on("end",()=>resolve("Some"))
                response.on("error",(err)=>{
                    console.log("error occured")
                    console.log(err)
                    rejects(null)
                })
            })
        })
        let bhav_path = "./bhav/"
        if(!checker){
            if(tries == Number(process.env.MAX_RETRIES)){
                // send mail to admin here
                await transporter.sendMail(
                    {
                        to: process.env.ADMIN_MAIL,
                        from: "experimental.vilas@gmail.com",
                        text: "unable to insert todays data "+ new Date().toString(),
                        subject: "Unable to Scrape Data getTodaysData" 
                    }
                )
            }
            if(tries < Number(process.env.MAX_RETRIES)){
                await puppeteer.main(url)
                this.getTodaysData(date,tries += 1)
            }
            return
        }
        await decompress("./bhav.zip","bhav").then((files)=>{
            console.log(files)
            bhav_path = bhav_path + files[0].path
            console.log("Extraction Complete")
            return
        })
        fs.createReadStream(bhav_path)
            .pipe(csv())
            .on("data",async(data)=> {
                if(data.SERIES=="EQ"){
                    data = await this.parseBhavCopy(data)
                    await this.insertIntoDb(data)
                }
            })
            .on("end",()=>{
                console.log("read end")
                setTimeout(()=>{
                    fs.rm(bhav_path,(err)=>{
                        if(err){
                            console.log("err while removing")
                        }
                        console.log("removed successfully")
                    })
                },10000)
            })
    }catch(err){
        await transporter.sendMail(
                {
                    to: process.env.ADMIN_MAIL,
                    from: "experimental.vilas@gmail.com",
                    text: `Error inside getTodaysData ${JSON.stringify(err)} ${new Date().toString()}`,
                    subject: "error inside getTodayaData" 
                }
            ).catch((err)=>{
                console.log(err)
            })
        console.log(err)
        // return res.status(500).send({status:ResCode.failure,message:"Something went wrong"})
    }
}

exports.insertIntoDb = async(data) =>{
    console.log(`${data.TIMESTAMP} ${data.SYMBOL}`)
    let insert = await db.collection(data.SYMBOL).insertOne(data)
    priceNotifier.startEmitting(data.SYMBOL,data.CLOSE,data.PREVCLOSE)
    if(!insert.acknowledged){
        console.log(`Insert failed ${data.SYMBOL}`)
    }
}

exports.parseBhavCopy = async(data) => {

    try{
        Object.keys(data).forEach((ele)=>{
            if(ele=="OPEN" || ele=="CLOSE" || ele=="HIGH" || ele=="LOW"){
                data[ele] = parseFloat(data[ele])
            }

            if(ele=="LAST" || ele=="PREVCLOSE" || ele=="TOTTRDVAL" ){
                data[ele] = parseFloat(data[ele])
            }

            if(ele=="TIMESTAMP"){
                data[ele] = new Date(data[ele])
            }

            if(ele==""){
                delete data[ele]
            }

            if(ele=="TOTTRDQTY" || ele=="TOTALTRADES"){
                data[ele] = parseInt(data[ele])
            }

        })
        return data
    }catch(err){
        console.log(err)
        // return res.status(500).send({status:ResCode.failure,message:"Something went wrong"})
    }

}

exports.getSymbols = async(req,res) => {
    try{

        let collection = db.collection("Symbols")
        let data = []

        if(req.query.q){
            let collections = await collection.aggregate([
                {$match:{
                    $or:[
                        {'SYMBOL': new RegExp(`\\b${req.query.q}`,"i")},
                        {"NAME_OF_COMAPNY": new RegExp(`\\b${req.query.q}`,"i")}
                    ]
                }},
                {$project:{SYMBOL: 1, NAME_OF_COMAPNY: 1}},
                {$limit: parseInt(process.env.PAGE_SIZE)}
            ]).forEach((e)=>{
                data.push(e)
            })
        }else{
            let collections = await db.collection("users").findOne({_id: req.body.USERNAME})
            data = collections.WATCHLIST    
        }

        
        
        return res.status(200).send({status:ResCode.success,data:data})

    }catch(err){
        console.log(err)
        return res.status(500).send({status:ResCode.failure,message:"Something went wrong"})
    }
}

exports.getData = async(req,res) => {
    try{
        if(req.params.symbol==undefined || req.params.symbol==""){
            return res.status(400).send({status:ResCode.failure,msg:"Symbol is required"})
        }

        if(!await this.hasSymbol(req.params.symbol)){
            return res.status(400).send({status:ResCode.failure,msg:"symbol does not exsist"})
        }

        let intervel = parseInt(req.query.i) || 30
        
        let resp = await db.collection(req.params.symbol).aggregate([
            {$match:{"TIMESTAMP":{$gte: new Date(Date.now()-(86400000*intervel))}}},
            {$sort:{TIMESTAMP:1}}
        ]).toArray()

        // console.log(resp)
        
        return res.status(200).send({status:ResCode.success,msg:"success",data:resp})

    }catch(err){
        console.log(err)
        return res.status(500).send({status:ResCode.failure,msg:"Something went wrong at server"})
    }
}

exports.Bites = async(req,res) => {
    try{
        let data = await db.collection(req.query.symbol).find({"TIMESTAMP":{$gte: new Date(Date.now()-86400000*365)}},{sort:{"TIMESTAMP":-1}}).toArray()
        data = await Promise.all(
            data.map((e)=>{
                return {CLOSE:e.CLOSE,TIMESTAMP:e.TIMESTAMP}
            })
        )
        
        let curr = data[0].CLOSE

        async function highLow(timeFrame,label){
            let date = new Date()
            date.setHours(0)
            let tmp = data.filter((ele)=>{
                return new Date(ele.TIMESTAMP)>=new Date(date-timeFrame)
            })

            let trimDate = await Promise.all(
                tmp.map((e)=>{
                    return e.CLOSE
                })
            )
            let high = Math.max(...trimDate)
            let low = Math.min(...trimDate)

            return {label,curr,high,low}
        }

        let bites = []

        for(let i=0;i<bitesFrame.length;i++){
            let bite = await highLow(bitesFrame[i].timeFrame,bitesFrame[i].label)
            bites.push(bite)
        }

        return res.status(200).send({status:ResCode.success,msg:"success",data:bites})

    }catch(err){
        console.log(err)
        return res.status(500).send({status:ResCode.failure,msg:"Something went wrong at server"})
    }
}

exports.getHighlights = async(date,tries = 0)=>{
    try{
        const file = fs.createWriteStream("./highlights.csv")
        let url = `https://archives.nseindia.com/archives/equities/mkt/MA${date}.csv`

        let checker = await new Promise((resolve,rejects)=>{
            https.get(url,{
                headers:{
                    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.1.1 Safari/605.1.15",
                    "Referer": "http://www.google.com/",
                    "cookie": "NSE-TEST-1=1960845322.20480.0000; path=/"
                }
            },(response)=>{
                console.log(response.statusCode)
                if(response.statusCode!=200){
                    return rejects(null)
                }
                response.pipe(file)
                response.on("data",()=>console.log("Data"))
                response.on("end",()=>resolve("Some"))
                response.on("error",(err)=>{
                    console.log("error occured")
                    console.log(err)
                    rejects(null)
                })
            })
        })
        let highLightsPath = "./highlights.csv/"
        if(!checker){

            if(tries == Number(process.env.MAX_RETRIES)){
                // send mail to admin here
                await transporter.sendMail(
                    {
                        to: process.env.ADMIN_MAIL,
                        from: "experimental.vilas@gmail.com",
                        text: "unable to insert todays data "+ new Date().toString(),
                        subject: "Unable to Scrape Data getHighLights" 
                    }
                )
            }

            if(tries < Number(process.env.MAX_RETRIES)){
                await puppeteer.main(url)
                this.getHighlights(date, tries += 1)
            }
            return
        }

        let date_helper = new Date().toDateString().split(" ")
        date_helper = [date_helper[2],date_helper[1],date_helper[3]].join("-")
        let i=0;

        let Indexs = []
        let Top_25_sec = []
        let Top_5_gainers = []
        let Top_5_losers = []

        fs.createReadStream(highLightsPath)
            .pipe(csv())
            .on("data",async(data)=> {
                i=i+1;
                if(i>8 && i<80){
                    let raw = {
                        "INDEX": data[date_helper],
                        "PREV_CLOSE": parseFloat(data._2),
                        "OPEN": parseFloat(data._3),
                        "HIGH": parseFloat(data._4),
                        "LOW": parseFloat(data._5),
                        "CLOSE": parseFloat(data._6),
                        "CHANGE": parseFloat(data._7)
                    }

                    Indexs.push(raw)

                }else if(i>88 && i<114){
                    let raw = {
                        "SYMBOL": data[date_helper],
                        "SERIES": data._2,
                        "PREV_CLOSE": parseFloat(data._3),
                        "CLOSE": parseFloat(data._4),
                        "CHANGE": parseFloat(data._5),
                        "VALUE": parseFloat(data._6)
                    }
                    Top_25_sec.push(raw)
                }else if(i>116 && i<122){
                    let raw = {
                        "SYMBOL": data[date_helper],
                        "SERIES": data._2,
                        "CLOSE": parseFloat(data._3),
                        "PREV_CLOSE": parseFloat(data._4),
                        "CHANGE": parseFloat(data._5)
                    }

                    Top_5_gainers.push(raw)

                }else if(i>124 && i<130){
                    let raw = {
                        "SYMBOL": data[date_helper],
                        "SERIES": data._2,
                        "CLOSE": parseFloat(data._3),
                        "PREV_CLOSE": parseFloat(data._4),
                        "CHANGE": parseFloat(data._5)
                    }

                    Top_5_losers.push(raw)
                }
                
            })
            .on("end",()=>{

                let final_data = {
                    "INDEXES": Indexs,
                    "TOP_25_SEC": Top_25_sec,
                    "TOP_5_GAINERS": Top_5_gainers,
                    "TOP_5_LOSERS": Top_5_losers,
                    "TIMEFRAME": new Date().toDateString()
                }

                this.InsertHighlights(final_data)
                console.log("read end")
                setTimeout(()=>{
                    fs.rm(highLightsPath,(err)=>{
                        if(err){
                            console.log("err while removing")
                        }
                        console.log("removed successfully")
                    })
                },10000)
            })


    }catch(err){
        await transporter.sendMail(
                {
                    to: process.env.ADMIN_MAIL,
                    from: "experimental.vilas@gmail.com",
                    text: `Error inside getHighlights ${JSON.stringify(err)} ${new Date().toString()}`,
                    subject: "error inside gethighlights" 
                }
            ).catch((err)=>{
                console.log(err)
            })
        console.log(err)
        return {status:ResCode.failure,msg:"Something Went Wrong at server"}
    }
}


exports.InsertHighlights = async(data)=>{
    try{

        let insert = await db.collection("highlights").insertOne(data)
        if(!insert.acknowledged){
            console.log(`Highlights Insert failed`)
        }
    }catch(err){
        console.log(err)
        return {status:ResCode.failure,msg:"Something Went Wrong at server"}
    }
}

exports.GetHighlights = async(req,res)=>{
    try{
        let date = new Date()
        let highLight = null

        while(!highLight){
            let date_string = date.toDateString()
            highLight = await db.collection("highlights").findOne({"TIMEFRAME": date_string})
            date.setDate(date.getDate()-1)
        }

        return res.status(200).send({status:ResCode.success,success:"true",data:highLight})

    }catch(err){
        console.log(err)
        return res.status(500).send({status:ResCode.failure,msg:"something went wrong at server"})
    }
}

exports.CreatePriceAlert = async(req,res)=>{
    try{
        let user = await db.collection("users").findOne({_id: req.body.USERNAME})
        if(!user){
            return res.status(400).send({status:ResCode.failure,msg:"Unauthorized"})    
        }


        let latest_price = null
        let date = new Date(new Date().toDateString())
        while(!latest_price){
            let date_string = date
            latest_price = await db.collection(req.body.symbol).findOne({"TIMESTAMP": date_string})
            date.setDate(date.getDate()-1)
        }

        let data = {
            _id: new ObjectId(),
            PRICE: Number(Number(req.body.price).toFixed(process.env.PRICE_PRECISION)),
            SYMBOL: req.body.symbol,
            TIMESTAMP: new Date(),
            COMPLETED: false,
            MAILTO: user.EMAILID,
            USERNAME: req.body.USERNAME
        }

        await db.collection("PriceAlerts").insertOne(data)
        priceNotifier.startListen(data.SYMBOL,data.PRICE.toFixed(process.env.PRICE_PRECISION),()=>{
            PriceAlertQueue.push(data._id.toString())
        })

        return res.status(200).send({status:ResCode.success,msg:"Alert set successfully. You'll receive a email when price your target price"})

    }catch(err){
        console.log(err)
        return {status:ResCode.failure,msg:"Something Went Wrong at server"}
    }
}

exports.GetCalenderData = async(req,res) =>{
    try{
        let date = new Date(req.body.date)
        date.setDate(1)
        let maxDate = new Date(date)
        maxDate.setMonth(date.getMonth()+1)
        let symbol = req.body.symbol
        if(!await this.hasSymbol(symbol)){
            return res.status(400).send({status:ResCode.failure,msg:"symbol does not exsist"})
        }

        let data = await db.collection(symbol).find({$and:[{TIMESTAMP:{$gte: date}},{TIMESTAMP:{$lt:maxDate}}]},{sort:{TIMESTAMP:1}}).toArray()

        return res.status(200).send({status: ResCode.success,msg:"success",data:data})

    }catch(err){
        console.log(err)
        return {status:ResCode.failure,msg:"Something Went Wrong at server"}
    }
}

exports.SendVerificationMail = async(req,res) => {
    try{
        if(!req.body.email){
            return res.status(400).send({status: ResCode.failure, msg: "email is required"})
        }
        req.body.email = req.body.email.toLowerCase()
        let emailregex = /[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/

        if(!emailregex.test(req.body.email)){
            return res.status(400).send({status: ResCode.failure, msg: "invalid email id"})
        }

        let otp =
            Array(6)
                .fill(1)
                .map(() => {
                return Math.floor(Math.random() * 9 + 1);
                })
                .join("")

        let data = {
            OTP: otp,
            EMAIL: req.body.email
        }

        await transporter.sendMail(
            {
                from: 'experimental.vilas@gmail.com',
                to: req.body.email,
                subject: "EMAIL Verification. Bhav Copy",
                text: "Your otp to verify at Bhav Copy is " + otp
            }
        )

        await db.collection("EMAILS").insertOne(data)

        return res.status(200).send({status: ResCode.success, msg: "OTP sent successfully"})

    }catch(err){
        console.log(err)
        return res.status(200).send({status: ResCode.success, msg: "Failed to send otp"})
    }
}

exports.VerifyOtp = async(req,res) => {
    try{
        let otp = await db.collection("EMAILS").findOneAndUpdate({EMAIL: req.body.email, OTP: req.body.otp},{$set:{VERIFIED: true}})

        if(otp){
            return res.status(200).send({status: ResCode.success, msg: "otp verified successfully"})
        }

        return res.status(400).send({status: ResCode.failure, msg: "incorrect otp"})

    }catch(err){
        console.log(err)
        return res.status(400).send({status: ResCode.failure, msg: "unable to verify otp currently. please try after sometime"})
    }
}


exports.listAlerts = async(req,res) => {
    try{
        let alerts = await db.collection("PriceAlerts").find({USERNAME: req.body.USERNAME},{projection:{PRICE: 1, SYMBOL: 1, TIMESTAMP: 1, COMPLETED: 1, DELETED: 1}}).toArray()
        return res.status(200).send({status: ResCode.success, msg: "success", data:alerts})
    }catch(err){
        console.log(err)
        return res.status(400).send({status: ResCode.failure, msg: "unable to get price alerts. please try after sometime"})
    }
}

exports.getUserDetails = async(req,res) => {
    try{
        let user = await db.collection("users").findOne({_id: req.body.USERNAME})
        return res.status(200).send({status: ResCode.success, msg: "success", data:{USERNAME: user._id, EMAILID: user.EMAILID}})
    }catch(err){
        console.log(err)
        return res.status(500).send({status: ResCode.failure, msg: "error while getting user details. please try after sometime."})
    }
}

exports.updatePreference = async(req,res) => {
    try{
        if(req.body.action == "get"){
            let user = await db.collection("users").findOne({_id: req.body.USERNAME})
            return res.status(200).send({status: ResCode.success, msg: "success", newsletter: user.NEWSLETTER})
        }else if(req.body.action == "update"){
            let user = await db.collection("users").findOne({_id: req.body.USERNAME})
            let preference = !user.NEWSLETTER
            await db.collection('users').updateOne({_id: req.body.USERNAME},{$set:{NEWSLETTER: preference}})
            return res.status(200).send({status: ResCode.success, msg: 'success', newsletter: preference})
        }
    }catch(err){
        console.log(err)
        return res.status(500).send({status: ResCode.failure, msg: "error while getting preference. please try after sometime"})
    }
}


exports.deletePriceAlert = async(req,res) => {
    try{
        let alert = await db.collection("PriceAlerts").findOne({_id: ObjectId(req.body._id), DELETED: {$ne: true}, COMPLETED: {$ne: true}})
        if(alert){
            db.collection('PriceAlerts').updateOne({_id: ObjectId(req.body._id)},{$set:{DELETED: true}})
            return res.status(200).send({status: ResCode.success, msg: "alert deleted successfully"})
        }
        return res.status(400).send({status: ResCode.failure, msg: "alert does not exsist or already deleted"})
    }catch(err){
        console.log(err)
        return res.status(500).send({status: ResCode.failure, msg: "error while getting preference. please try after sometime"})
    }
}


exports.deleteAccount = async(req,res) => {
    try{
        let user = await db.collection("users").findOne({_id: req.body.USERNAME})
        db.collection("deletedUsers").insertOne(user)
        db.collection("users").deleteOne({_id: req.body.USERNAME})
        return res.status(200).send({status: ResCode.success, msg: "account deleted successfully"})
    }catch(err){
        console.log(err)
        return res.status(500).send({status: ResCode.failure, msg: "unable to delete account. please try after sometime"})
    }
}

exports.addToWatchList = async(req,res) => {
    try{
        let checkStock = await db.collection("Symbols").findOne({SYMBOL: req.body.symbol})
        if(!checkStock){
            return res.status(400).send({status: ResCode.failure, msg: "Symbol does not exsist"})
        }
        let stock = {
            SYMBOL: checkStock.SYMBOL,
            NAME_OF_COMAPNY: checkStock.NAME_OF_COMPANY
        }
        await db.collection("users").updateOne({_id: req.body.USERNAME},{$addToSet:{"WATCHLIST": stock}})

        return res.status(200).send({status: ResCode.success, msg: "added to watchlist"})

    }catch(err){
        console.log(err)
        return res.status(500).send({status: ResCode.failure, msg: "unable to delete account. please try after sometime"})
    }
}

exports.removeFromWatchList = async(req,res) => {
    try{
        let checkStock = await db.collection("Symbols").findOne({SYMBOL: req.body.symbol})
        if(!checkStock){
            return res.status(400).send({status: ResCode.failure, msg: "Symbol does not exsist"})
        }

        await db.collection("users").updateOne({_id: req.body.USERNAME},{$pull:{"WATCHLIST": {"SYMBOL": req.body.symbol}}})

        return res.status(200).send({status: ResCode.success, msg: "removed from watchlist"})

    }catch(err){
        console.log(err)
        return res.status(500).send({status: ResCode.failure, msg: "unable to remove stock from watchlist. please try after sometime"})
    }
}