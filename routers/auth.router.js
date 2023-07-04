const router = require("express").Router()
const {signup, login, getOtp, verifyOtp,userNameAvailable,PingResponse } = require("../controllers/user.controller")

router.get("/ping",PingResponse)
router.post("/signup",signup)
router.post("/signin", login)
router.post("/get-otp", getOtp)
router.post("/verify-otp", verifyOtp)
router.post("/is-userName-available",userNameAvailable)
module.exports = router