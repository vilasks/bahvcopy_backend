const client = require("../db/connection")
const db = client.db("bhav")
const {ResCode} = require("../models/response.codes")
const crypto = require("crypto")
const jwt = require("jsonwebtoken")
const { transporter } = require("../mailer/mailer")
const axios = require("axios")
class User{
    #database = db.collection("users")
    hashFunction = crypto.createHash("sha256")
    constructor(){
        
    }

    async createUser(userName,emailId,Password,newsLetter=false){
        if(await this.checkEmailExists(emailId)){
            return {success: false, msg: "A user exists with current EmailId. please use different EmailId"}
        }

        if(await this.checkUserNameExists(userName)){
            return {success: false, msg: "User Name already taken. Please use different User Name"}
        }

        let salt = this.createSalt()
        let hash = this.hashFunction.update(Password+salt).digest("hex")

        let token = jwt.sign({USERNAME: userName},process.env.JWT_SECRET,{expiresIn: "7d"})
        let create = await this.#database.insertOne({_id: userName,EMAILID: emailId, HASH: hash, SALT: salt, NEWSLETTER: newsLetter})

        if(create.acknowledged){
            return {success: true,msg: token}
        }

        return {success: false, msg: "something went wrong"}

    }

    async checkEmailExists(emailId){
        let email = await this.#database.findOne({EMAILID: emailId})
        if(email){
            return true
        }
        return false
    }

    async checkUserNameExists(userName){
        let user = await this.#database.findOne({_id: userName})
        if(user){
            return true
        }
        return false
    }

    createSalt(){
        return crypto.randomBytes(64).toString("hex")
    }

}


async function signup(req,res){
    try{
        let user = new User()
        let create = await user.createUser(req.body.userName,req.body.emailId,req.body.password)
        if(create.success){
            return res.status(200).send({status: ResCode.success, msg: create.msg})
        }

        return res.status(400).send({status: ResCode.failure, msg: create.msg})
    }catch(err){
        console.log(err)
        return res.status(500).send({status: ResCode.failure, msg: "unable to signup users currently. please try after sometime"})
    }
}

async function login(req,res){
    try{
        let hashFunction = crypto.createHash("sha256")
        let salt = await db.collection("users").findOne({$or:[{_id: req.body.id},{EMAILID: req.body.id}]})
        if(!salt){
            return res.status(400).send({status: ResCode.failure, msg: "user does not exists. please check your credentials"})
        }

        if(salt.HASH === hashFunction.update(req.body.password+salt.SALT).digest("hex")){
            let token = jwt.sign({USERNAME: salt._id},process.env.JWT_SECRET,{expiresIn: "7d"})
            res.setHeader("authorization",`Bearer ${token}`)
            return res.status(200).send({status: ResCode.success, msg: token})
        }

        return res.status(401).send({status: ResCode.failure, msg: "invalid userid or password. please check your credentials"})
        
    }catch(err){
        console.log(err)
        return res.status(500).send({status: ResCode.failure, msg: "error while logging in"})
    }
}


async function getOtp(req,res){
    try{
        if(!/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?/.test(req.body.emailId)){
            return res.status(400).send({status: ResCode.failure, msg: "Please Enter a valid Email Address"})
        }

        let emailExsist = await db.collection("users").findOne({EMAILID: req.body.emailId})
        if(emailExsist){
            return res.status(400).send({status: ResCode.failure, msg: "Email Id already in use. Please Use another EmailId"})
        }

        let userExsist = await db.collection('users').findOne({_id: req.body.userName})
        if(userExsist){
            return res.status(400).send({status: ResCode.failure, msg: "userName is taken. Please Use different userName"})
        }

        let otp = Array(4).fill(1).map(()=>((Math.random() * 9) + 1).toFixed()).join("")
        let mailOptions = {
            from: 'experimental.vilas@gmail.com',
            to: req.body.emailId,
            subject: 'OTP Verification for Bhav Copy',
            text: `Your otp for verification is ${otp} and is only valid for another 10 Minutes`
        }

        let mail = await transporter.sendMail(mailOptions)
        if(!mail.messageId){
            return res.status(400).send({status: ResCode.failure, msg: "Unable to sendOtp. please try after sometime"})
        }

        let hashFunction = crypto.createHash("sha256")
        let hash = hashFunction.update(otp).digest("hex")

        let data = {
            _id: req.body.emailId,
            OTP: hash,
            TIMESTAMP: new Date()
        }
        let checkDup = await db.collection("tmp_users").findOne({_id: req.body.emailId})
        if(checkDup){
            await db.collection("tmp_users").updateOne({_id: req.body.emailId},{$set:{OTP: hash, TIMESTAMP: new Date()}})
        }else{
            await db.collection("tmp_users").insertOne(data)
        }
        return res.status(200).send({status: ResCode.success, msg: "Otp sent Successfully"})

    }catch(err){
        console.log(err)
        return res.status(500).send({status: ResCode.failure, msg: "Unable to send otp. Please try after sometime"})
    }
}

async function verifyOtp(req,res){
    try{

        let getUser = await db.collection("tmp_users").findOne({_id: req.body.emailId})
        if(!getUser){
            return res.status(400).send({status: ResCode.failure, msg: "Something went wrong"})
        }

        let hashFunction = crypto.createHash("sha256")
        let hash = hashFunction.update(req.body.otp).digest("hex")
        let time = new Date(Date.now() - (parseInt(process.env.OTP_EXPIRY)*60000))
        if(getUser.TIMESTAMP < time){
            return res.status(400).send({status: ResCode.failure, msg: "Otp Expired. Please try after sometime"})
        }

        if(hash === getUser.OTP){
            let user = new User()
            let create = await user.createUser(req.body.userName,req.body.emailId,req.body.password,req.body.newsletter)
            await db.collection("tmp_users").updateOne({_id: req.body.emailId},{$set: {VERIFIED: true}})
            return res.status(200).send({status: ResCode.success, msg: "Otp Verified Successfully"})
        }
        return res.status(400).send({status: ResCode.failure, msg: "Incorrect OTP"})

    }catch(err){
        console.log(err)
        return res.status(500).send({status: ResCode.failure, msg: "Unable to verify otp. Please try after sometime"})
    }
}

async function userNameAvailable(req,res){
    try{
        let user = new User()
        if(await user.checkUserNameExists(req.body.userName)){
            return res.status(200).send({status: ResCode.success, available: false, msg: "userName is already taken. Please use a different name"})
        }
        return res.status(200).send({status: ResCode.success, available: true, msg: "userName is available"})
    }catch(err){
        console.log(err)
        return res.status(500).send({status: ResCode.failure, msg: "Unable to check user name availability. Please try after sometime"})
    }
}

async function PingResponse(req,res) {
    try{
        return res.status(200).send({status: ResCode.success, success: true, msg: "system online"})
    }catch(e){
        return res.status(200).send({status: ResCode.success, success: true, msg: "system online"})
    }
}

async function Ping() {
    try{
        let server = process.env.PING_SERVERS.split(",")
        server.forEach(async(ele)=>{
            let ping = await axios.get(ele).catch((err)=>{
                console.log(err.response.status)
            })
        })
    }catch(e){
        console.log(e)
    }
}

module.exports = {
    User, signup, login, getOtp, verifyOtp, userNameAvailable, Ping, PingResponse
}