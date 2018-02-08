module.exports = function(app, passport) {

    var recaptcha = require("./recaptcha");
    var User = require('../app/models/user');
    var userProfile = require('./userprofile')();
    var wallets = require('./wallets')();

// normal routes ===============================================================

    // show the home page (will also have our login links)
    app.get('/', function(req, res) {
        var flashKey = 'signupMessage', flash = req.flash(flashKey);
        if(flash.length > 0) {
            if(flash[0] === 'verify') {
                res.redirect("/#reverified");
                return;
            }
            req.flash(flashKey, flash[0]);
        }
        res.render('index.ejs', { req : req, res : res });
    });

    // PROFILE SECTION =========================
    app.get('/profile', isLoggedIn, function(req, res, done) {
        wallets.getUserWallets(req.user.id, function(results)
        {
            userProfile.getUserSettings(req, req.user, function(user) {
                res.render('profile.ejs', {
                    user : user,
                    message : req.flash('profileMessage').toString(),
                    wallets : results
                });    
            }, function(error) {
                done(err);    
            });
        }, function(err) {
            done(err);
        });
    });

    // LOGOUT ==============================
    app.get('/logout', function(req, res) {
        req.logout();
        res.redirect('/');
    });

// =============================================================================
// AUTHENTICATE (FIRST LOGIN) ==================================================
// =============================================================================

    // locally --------------------------------
        // LOGIN ===============================
        // show the login form
        app.get('/login', function(req, res) {
            res.render('auth.ejs', { 
                message: req.flash('loginMessage').toString(),
                action: "login",
                actionTitle: " Login ",
                promptLocation: "../static/pages/signup.html"
            });
        });

        // process the login form
        app.post('/login', recaptcha(passport.authenticate('local-login', {
                successRedirect : '/#profile', // redirect to the secure profile section
                failureRedirect : '/#login', // redirect back to the signup page if there is an error
                failureFlash : true // allow flash messages
            }), function(req, res, next, errText) {
                req.flash('loginMessage', errText);
                res.redirect('/#login');
            }));

        // show password reset form
        app.get('/password', function(req, res) {
            res.render('resetpass.ejs', { 
                message: req.flash('passwordMessage').toString()
            });
        });

        // process the login form
        app.post('/password', recaptcha(function(req, res, next){
            userProfile.resetPassword('/#resetpassmess', req, res, next);
        }, function(req, res, next, errText) {
            req.flash('passwordMessage', errText);
            res.redirect('/#password');
        }));
    
        // SIGNUP =================================
        // show the signup form
        app.get('/signup', function(req, res) {
            res.render('auth.ejs', { 
                message: req.flash('signupMessage').toString(),
                action: "signup",
                actionTitle: " Signup ",
                promptLocation: "../static/pages/login.html"
            });
        });

        // process the signup form
        app.post('/signup', recaptcha(passport.authenticate('local-signup', {
            successRedirect : '/#reverified', // redirect to the secure profile section
            failureRedirect : '/#signup', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
        }), function(req, res, next, errText) {
            req.flash('signupMessage', errText);
            res.redirect('/#signup');
        }));

        // verify email
        app.get('/verify/:userName/:token?', function(req, res, next) {
            var userName = req.params.userName.toLowerCase();
            User.findOne({ 'local.email' :  userName }, function(err, user) {
                // if there are any errors, return the error
                if (err)
                {
                    log('error', logSystem, 'Failed to load user details by email: %s', [err]);
                    res.redirect('/#notverified');
                    return; 
                }

                // check if this is token verification step where both user and token specificed
                if (user && req.params.token === user.local.verify_token) {
                    user.local.verified = true;
                    user.save(function(err) {
                        if (err) {
                            log('error', logSystem, 'Failed to mark user as email verified: %s', [err]);
                            return;
                        }
                        res.redirect('/#verified');
                    });
                } else {
                    if(user && req.params.token) {
                        log('warn', logSystem, 'Email verification token mismatch for %s', [userName]);
                    } else if(user === null) {
                        log('info', logSystem, 'User %s not found for email verification', [userName]);
                    } else {
                        passport.verifyEmail(user, function(error){
                            if(error) {
                                log('error', logSystem, 'Failed to re-send email for user %s: %s', [user.local.email, error.toString()]);
                                // complete user registration anyway
                            }
                            res.redirect('/#reverified');
                        });
                        return;
                    }
                    res.redirect('/#notverified');
                    return;
                }
            });            

        });

        // change password
        app.post('/changepass', userProfile.changePassword);

        app.post('/savewallets', userProfile.saveWallets);

        app.post('/saveNfSettings', userProfile.saveNfSettings);

    // facebook -------------------------------

        // send to facebook to do the authentication
        app.get('/auth/facebook', passport.authenticate('facebook', { scope : ['public_profile', 'email'] }));

        // handle the callback after facebook has authenticated the user
        app.get('/auth/facebook/callback',
            passport.authenticate('facebook', {
                successRedirect : '/profile',
                failureRedirect : '/'
            }));

    // twitter --------------------------------

        // send to twitter to do the authentication
        app.get('/auth/twitter', passport.authenticate('twitter', { scope : 'email' }));

        // handle the callback after twitter has authenticated the user
        app.get('/auth/twitter/callback',
            passport.authenticate('twitter', {
                successRedirect : '/profile',
                failureRedirect : '/'
            }));


    // google ---------------------------------

        // send to google to do the authentication
        app.get('/auth/google', passport.authenticate('google', { scope : ['profile', 'email'] }));

        // the callback after google has authenticated the user
        app.get('/auth/google/callback',
            passport.authenticate('google', {
                successRedirect : '/profile',
                failureRedirect : '/'
            }));

// =============================================================================
// AUTHORIZE (ALREADY LOGGED IN / CONNECTING OTHER SOCIAL ACCOUNT) =============
// =============================================================================

    /* locally --------------------------------
        app.get('/connect/local', function(req, res) {
            res.render('connect-local.ejs', { message: req.flash('loginMessage') });
        });
        app.post('/connect/local', passport.authenticate('local-signup', {
            successRedirect : '/profile', // redirect to the secure profile section
            failureRedirect : '/connect/local', // redirect back to the signup page if there is an error
            failureFlash : true // allow flash messages
        }));
    */
    
    // facebook -------------------------------

        // send to facebook to do the authentication
        app.get('/connect/facebook', passport.authorize('facebook', { scope : ['public_profile', 'email'] }));

        // handle the callback after facebook has authorized the user
        app.get('/connect/facebook/callback',
            passport.authorize('facebook', {
                successRedirect : '/profile',
                failureRedirect : '/'
            }));

    // twitter --------------------------------

        // send to twitter to do the authentication
        app.get('/connect/twitter', passport.authorize('twitter', { scope : 'email' }));

        // handle the callback after twitter has authorized the user
        app.get('/connect/twitter/callback',
            passport.authorize('twitter', {
                successRedirect : '/profile',
                failureRedirect : '/'
            }));


    // google ---------------------------------

        // send to google to do the authentication
        app.get('/connect/google', passport.authorize('google', { scope : ['profile', 'email'] }));

        // the callback after google has authorized the user
        app.get('/connect/google/callback',
            passport.authorize('google', {
                successRedirect : '/profile',
                failureRedirect : '/'
            }));

// =============================================================================
// UNLINK ACCOUNTS =============================================================
// =============================================================================
// used to unlink accounts. for social accounts, just remove the token
// for local account, remove email and password
// user account will stay active in case they want to reconnect in the future

    /* local -----------------------------------
    app.get('/unlink/local', isLoggedIn, function(req, res) {
        var user            = req.user;
        user.local.email    = undefined;
        user.local.password = undefined;
        user.save(function(err) {
            res.redirect('/profile');
        });
    });
    */

    // facebook -------------------------------
    app.get('/unlink/facebook', isLoggedIn, function(req, res) {
        var user            = req.user;
        user.facebook.token = undefined;
        user.save(function(err) {
            res.redirect('/profile');
        });
    });

    // twitter --------------------------------
    app.get('/unlink/twitter', isLoggedIn, function(req, res) {
        var user           = req.user;
        user.twitter.token = undefined;
        user.save(function(err) {
            res.redirect('/profile');
        });
    });

    // google ---------------------------------
    app.get('/unlink/google', isLoggedIn, function(req, res) {
        var user          = req.user;
        user.google.token = undefined;
        user.save(function(err) {
            res.redirect('/profile');
        });
    });
};

// route middleware to ensure user is logged in
function isLoggedIn(req, res, next) {
    if (req.isAuthenticated())
        return next();

    res.redirect('/login');
}
