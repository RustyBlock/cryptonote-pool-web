module.exports = function()
{
    var User = require('../app/models/user');
    var wallets = require('./wallets')();
    var mailer = require('../app/mailer');
    var htmlencode = require('htmlencode');
    var randomstring = require("randomstring");

    return {
        changePassword: function(req, res, done) {
            if(req.body.password1 !== req.body.password2 || !isValidPassword(req.body.password1, req.user)) {
                req.flash('profileMessage', req.body.password1 !== req.body.password2 ? "Passwords do not match" : 
                    "Incorrect password. Expected minimum 8 characters including 1 upper case letter, 1 lower case letter and 1 number. Password should not be the same as user name.");
                res.redirect('/#profile');
                return;
            }
            
            User.findOne({ 'local.email' :  req.user.local.email }, function(err, user) {
                // if there are any errors, return the error
                if (err){
                    log('warn', logSystem, 'Failed to find user %s: %s', [req.user.local.email, err.toString()]);
                    return done(err);
                }

                // if no user is found, return the message
                if (!user) {
                    log('warn', logSystem, 'User not found for password change: %s', [req.user.local.email]);
                    return done(null, false);
                }

                user.local.password = user.generateHash(req.body.password1);

                user.save(function(err) {
                    if (err) {
                        log('error', logSystem, 'Failed to save password for user %s : %s', [req.user.local.email, err.toString()]);
                        return done(err);
                    }
                    log('info', logSystem, 'Password changed for user %s', [req.user.local.email]);
                    res.send('Ok');
                });
            });
        },

        saveWallets: function(req, res, done) {
            if (!req.isAuthenticated()) {
                return done(null, false);
            }
            User.findOne({ 'local.email' :  req.user.local.email }, function(err, user) {
                var currentWallets = [];
                // if there are any errors, return the error
                if (err) {
                    log('error', logSystem, 'Failed to find user %s: %s', [req.user.local.email, err.toString()]);
                    return done(err);
                }

                // if no user is found, return the message
                if (!user) {
                    log('warn', logSystem, 'User not found for wallets update: %s', [req.user.local.email]);
                    return done(null, false);
                }
                
                wallets.getUserWallets(user.id, function(currentWallets) {
                    var removed = [], added = [], countProcessed;

                    // determine added and removed wallets
                    currentWallets.forEach(function(item){
                        if (req.body.wallets.indexOf(item) === -1) {
                            removed.push(item);
                        }
                    });
                    req.body.wallets.forEach(function (item) {
                        item = item.trim();
                        if(item === "") { // skip empty lines
                            return;
                        }
                        if (currentWallets.indexOf(item) === -1) {
                            added.push(item);
                        }
                    });
                    
                    function processAdded()
                    {
                        if(added.length === 0) {
                            res.send("Ok");
                            return;
                        }
                        countProcessed = 0;
                        added.forEach(function(item) {
                            var newWalletId;
                            wallets.addWallet(item, user.id, function() {
                                countProcessed++
                                log('info', logSystem, 'Added wallet %s for user %s (%s)', [item, user.id, req.user.local.email]);
                                if(countProcessed === added.length){
                                    res.send("Ok");
                                }
                            }, function(err){
                                throw new Error(JSON.stringify(err));
                            });
                        });
                    }

                    countProcessed = 0;
                    try{
                        if(removed.length === 0) {
                            processAdded();
                        } else {
                            removed.forEach(function(item){
                                wallets.removeWallet(item, user.id, function(){
                                    countProcessed++;
                                    log('info', logSystem, 'Removed wallet %s for user %s', [item, req.user.local.email]);

                                    if(countProcessed === removed.length) {
                                        processAdded();
                                    }
                                }, function(err){
                                    throw new Error(JSON.stringify(err));
                                });
                            });
                        }
                    } catch(e) {
                        return done(JSON.parse(e.message));
                    }
                }, function(err) {
                    return done(err);
                });
            });            
        },

        saveNfSettings: function(req, res, done) {
            if (!req.isAuthenticated()) {
                return done(null, false);
            }

            var result = {}, 
                userKey = config.coin + ':auth:users:' + req.user.id + ':hashNf',
                redisCommands = [
                    ['hset', userKey, 'loEnabled', req.body.hashNf.loEnabled == "true"],
                    ['hset', userKey, 'hiEnabled', req.body.hashNf.hiEnabled == "true"],
                    ['hset', userKey, 'loRate', req.body.hashNf.loRate],
                    ['hset', userKey, 'hiRate', req.body.hashNf.hiRate]
                ];
                               
            redisClient.multi(redisCommands).exec(function(error, results) {
                if(error) {
                    log('error', logSystem, 'Failed ot save user notification settings: %s', [error.toString()]);
                    return done(error);
                }
                res.send("Ok");
            });
        },

        getUserSettings: function(req, user, success, error) {
            var result = {}, 
                userKey = config.coin + ':auth:users:' + user.id,
                redisCommands = [
                    ['hset', userKey, 'email', user.local.email],
                    ['hgetall', userKey + ':hashNf']
                ];

            redisClient.multi(redisCommands).exec(function(err, results) {
                if(err) {
                    log('error', logSystem, 'Failed to access user details: %s', [error.toString()]);
                    return error(err);
                }

                user.hashNf = results[1] || {
                    loEnabled: true,
                    hiEnabled: false,
                    loRate: 3000,
                    hiRate: 4000
                };

                return success(user);
            });
        },

        resetPassword: function(redirectUrl, req, res, done) {
            User.findOne({ 'local.email' :  req.body.email }, function(err, user) {
                var newPass = 'R' + randomstring.generate(6) + Math.floor(Math.random() * 10);
                // if there are any errors, return the error
                if (err){
                    log('warn', logSystem, 'Failed to find user %s for password reset: %s', [req.user.local.email, err.toString()]);
                    return done(err);
                }

                // if no user is found, return the message
                if (!user) {
                    log('warn', logSystem, 'User not found for password reset: %s', [req.body.email]);
                    return done(null, false);
                }

                user.local.password = user.generateHash(newPass);
                user.save(function(err) {
                    if (err) {
                        log('error', logSystem, 'Failed to reset password for user %s : %s', [user.local.email, err.toString()]);
                        return done(err);
                    }
                    log('info', logSystem, 'Password reset for user %s', [user.local.email]);

                    passowrdEmail(req.body.email, newPass, function() {
                        res.redirect(redirectUrl);
                    });
                });
            });            
        }
    };

    function isValidPassword(pwd, usr){
        var ucase = new RegExp("[A-Z]+"),
            lcase = new RegExp("[a-z]+"),
            num = new RegExp("[0-9]+");
            
        if(pwd && pwd.length >= 8) {
            return pwd.toLowerCase() !== usr.local.email.toLowerCase() && ucase.test(pwd) && lcase.test(pwd) && num.test(pwd);
        }
    
        return false;
    };    

    function passowrdEmail (email, password, callback) {
        var url = config.site + '#login';
        mailer.send(email, 'RustyBlock pool: password reset',
            null, 'Hello,<br/><br/>this email address was used for registration on RustyBlock cryptocurrency mining pool. ' + 
            'We\'ve sent this message in response to the password reset request made on RustyBlock web site.<br/><br/>' + 
            'You can <a href="' + url + '" target="_blank">login</a> with your email and this password: <b>' + htmlencode.htmlEncode(password) + '</b><br/>' +
            '<br/>--<br/><b>RustyBlock Team</b><br/><a href="mailto:' + process.env.emailAddressFrom + '">' + process.env.emailAddressFrom + '</a>',
            callback);
    };
};