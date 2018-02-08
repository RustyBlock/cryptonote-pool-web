/**
 * Sending email notifications
 * @module mailer
 */

var nodemailer = require('nodemailer').createTransport({
    host: process.env.emailServer,
    port: 465,
    secure: true,
    auth: {
      user: process.env.emailUser,
      pass: process.env.emailPassword
    }
  });

var logSystem = 'mailer';

exports.send = function(to, subject, text, html, callback)
{
    var mailOptions = {
        from: process.env.emailAddressFrom,
        to: to,
        subject: subject,
        text: text,
        html: html
      };
    
    nodemailer.sendMail(mailOptions, function(error, info){
        if (error) {
            log('error', logSystem, 'Failed to send notification: %s', [error.toString()]);
            if(callback) { callback(error); }
        } else {
            log('info', logSystem, 'Sent notification to %s about %s', [to, subject]);
            if(callback) { callback(null); }
        }
    });    
}
