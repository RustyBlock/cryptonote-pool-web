var captchaWidget;
function onLoadCaptcha() {
    captchaWidget = grecaptcha.render('captchaId', {
        'sitekey' : '6LdzjD0UAAAAAN2bTgOUP-eGIVnLsx-RhPgetsFu',
        'callback' : onSubmit, 
    });
}

function onSubmit() {
    document.forms[0].submit();
}

function validateCredentials(event) {
    event.preventDefault();
    if(formValid(event)){
        grecaptcha.execute(captchaWidget);
    }
}

function createCookie(name,value,days) {
    var date = new Date();
    date.setTime(date.getTime()+(days*24*60*60*1000));
    var expires = "; expires="+date.toGMTString();
    document.cookie = name+"="+value+expires+"; path=/";      
}

function readCookie(name) {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
        var c = ca[i];
        while (c.charAt(0)==' ') c = c.substring(1,c.length);
        if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;        
}

function parse_query_string(query) {
    var vars = query.split("&");
    var query_string = {};
    for (var i = 0; i < vars.length; i++) {
      var pair = vars[i].split("=");
      // If first entry with this name
      if (typeof query_string[pair[0]] === "undefined") {
        query_string[pair[0]] = decodeURIComponent(pair[1]);
        // If second entry with this name
      } else if (typeof query_string[pair[0]] === "string") {
        var arr = [query_string[pair[0]], decodeURIComponent(pair[1])];
        query_string[pair[0]] = arr;
        // If third or later entry with this name
      } else {
        query_string[pair[0]].push(decodeURIComponent(pair[1]));
      }
    }
    return query_string;
  }

  function formatLuck(difficulty, shares){
    //Only an approximation to reverse the calculations done in pool.js, because the shares with their respective times are not recorded in redis
    //Approximation assumes equal pool hashrate for the whole round
    //Could potentially be replaced by storing the sum of all job.difficulty in the redis db. 
    if (lastStats.config.slushMiningEnabled) {                                      //Uses integral calculus to calculate the average of a dynamic function
        var accurateShares = 1/lastStats.config.blockTime * (                       //1/blockTime to get the average
            shares * lastStats.config.weight * (                                    //Basically calculates the 'area below the graph' between 0 and blockTime
                1 - Math.pow(
                        Math.E, 
                        ((- lastStats.config.blockTime) / lastStats.config.weight)  //blockTime is equal to the highest possible result of (dateNowSeconds - scoreTime)
                    )
            )
        );
    }
    else {
        var accurateShares = shares;
    }

    if (difficulty > accurateShares){
        var percent = 100 - Math.round(accurateShares / difficulty * 100);
        return '<span class="luckGood">' + percent + '%</span>';
    }
    else{
        var percent = (100 - Math.round(difficulty / accurateShares * 100)) * -1;
        return '<span class="luckBad">' + percent + '%</span>';
    }
}