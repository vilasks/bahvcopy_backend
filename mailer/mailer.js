const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'experimental.vilas@gmail.com',
    pass: 'tgsgdkgxiflrreut'
  }
});

const mailOptions = {
  from: 'experimental.vilas@gmail.com',
  to: 'vvilas122@gmail.com',
  subject: 'Test',
  text: 'This is a test'
};

// transporter.sendMail(mailOptions, function(error, info){
//   if (error) {
//  console.log(error);
//   } else {
//     console.log('Email sent: ' + info.response);
//   }
// });

module.exports = {
  transporter
}