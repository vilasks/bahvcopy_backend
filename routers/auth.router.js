const router = require("express").Router()
const {signup, login, getOtp, verifyOtp} = require("../controllers/user.controller")

router.post("/signup",signup)
router.post("/signin", login)
router.post("/get-otp", getOtp)
router.post("/verify-otp", verifyOtp)

module.exports = router