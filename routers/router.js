const router = require("express").Router()
const Bhav = require("../controllers/bhavcopy.controller")
const AUTH = require("../controllers/auth.controller")
router.get("/",AUTH.verify,(req,res)=>{
    res.send("request received")
})


router.get("/get-symbols",Bhav.getSymbols)
router.get("/get-data/:symbol",Bhav.getData)
router.get("/bites",Bhav.Bites)
router.get("/highlights",Bhav.GetHighlights)
router.post("/create_alert",Bhav.CreatePriceAlert)
router.post("/get-calender-data",Bhav.GetCalenderData)
router.post("/send-otp", Bhav.SendVerificationMail)
router.post("/verify-otp", Bhav.VerifyOtp)
router.get("/list-alerts", Bhav.listAlerts)
router.get('/user-details', Bhav.getUserDetails)
router.post("/update-preference", Bhav.updatePreference)
router.post('/delete-price-alert', Bhav.deletePriceAlert)
router.delete('/delete-account',Bhav.deleteAccount)
router.post('/add-to-watchlist', Bhav.addToWatchList)
router.patch('/remove-from-watchlist', Bhav.removeFromWatchList)
module.exports = router