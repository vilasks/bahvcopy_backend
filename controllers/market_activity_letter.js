const client = require("../db/connection")
const db = client.db("bhav")
const {transporter} = require("../mailer/mailer")
const pug = require("pug")
const Async = require("async")
let mailQueue = Async.queue(SendMail,10)

const mailOptions = {
  from: 'experimental.vilas@gmail.com',
  to: 'vvilas122@gmail.com',
  subject: `${new Date().toDateString()} Market Report`,
};

async function SendMail(to){

    let Highlights = await db.collection("highlights").find({},{sort:{_id:-1}}).toArray()

    Highlights = Highlights[0]

    let htmldata = {
        top_gainers: await Promise.all(Highlights.TOP_5_GAINERS.map((ele)=>{
            return {
                SYMBOL: ele.SYMBOL,
                CHANGE: ele.CHANGE
            }
        })),

        top_losers: await Promise.all(Highlights.TOP_5_LOSERS.map((ele)=>{
            return {
                SYMBOL: ele.SYMBOL,
                CHANGE: ele.CHANGE
            }
        })),

        index_data: await Promise.all(Highlights.INDEXES.map((ele)=>{
            return {
                SYMBOL: ele.INDEX,
                CHANGE: ele.CHANGE
            }
        }))
    }

    console.log(htmldata)

    let html = pug.renderFile("./templates/market_activity.pug",htmldata)

    console.log(html)

    mailOptions.html = html
    mailOptions.to = to
    transporter.sendMail(mailOptions,(error,info)=>{
        if(error){
            console.log(error)
        }
        console.log(info)
    })
}

async function main(){
    let users = await db.collection("USERS").find({MARKET_ACTIVITY_MAIL: true}).toArray()
    users.forEach((user)=>{
        mailQueue.push(user.EMAIL)
    })
}


module.exports = {
    main
}


