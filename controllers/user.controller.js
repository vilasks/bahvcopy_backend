const client = require("../db/connection")
const db = client.db("bhav")
const {ResCode} = require("../models/response.codes")
const crypto = require("crypto")
const jwt = require("jsonwebtoken")

class User{
    #database = db.collection("users")
    hashFunction = crypto.createHash("sha256")
    constructor(){
        
    }

    async createUser(userName,emailId,Password){
        if(await this.#checkEmailExists(emailId)){
            return {success: false, msg: "A user exists with current EmailId. please use different EmailId"}
        }

        if(await this.#checkUserNameExists(userName)){
            return {success: false, msg: "User Name already taken. Please use different User Name"}
        }

        let salt = this.createSalt()
        let hash = this.hashFunction.update(Password+salt).digest("hex")

        let token = jwt.sign({USERNAME: userName},process.env.JWT_SECRET,{expiresIn: "7d"})
        let create = await this.#database.insertOne({_id: userName,EMAILID: emailId, HASH: hash, SALT: salt})

        if(create.acknowledged){
            return {success: true,msg: token}
        }

        return {success: false, msg: "something went wrong"}

    }

    async #checkEmailExists(emailId){
        let email = await this.#database.findOne({EMAILID: emailId})
        if(email){
            return true
        }
        return false
    }

    async #checkUserNameExists(userName){
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
            return res.status(200).send({status: ResCode.success, msg: jwt.sign({USERNAME: salt._id},process.env.JWT_SECRET,{expiresIn: "7d"})})
        }

        return res.status(401).send({status: ResCode.failure, msg: "invalid userid or password. please check your credentials"})
        
    }catch(err){
        console.log(err)
        return res.status(500).send({status: ResCode.failure, msg: "error while logging in"})
    }
}


module.exports = {
    User, signup, login
}