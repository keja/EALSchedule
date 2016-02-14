var request = require('request'),
    parser = require('xml2json'),
    user = null;

function getBetween(string, start, end){
    return string.substr(string.indexOf(start) + start.length).split(end)[0].trim();
}

module.exports = {
    login: function(username, password, callback){
        request(
        {
            method: 'PROPFIND',
            uri: 'https://p01-caldav.icloud.com',
            auth: {
                'user': username,
                'pass': password,
                'sendImmediately': true
            },
            headers: {
                "Depth": 1,
                "Content-Type": "text/xml; charset='UTF-8'",
                "User-Agent": "DAVKit/4.0.1 (730); EALSchedule/1.0.0 (100); iCal/4.0.1 (1374); Mac OS X/10.6.2 (10C540)"
            },
            body: "<A:propfind xmlns:A='DAV:'><A:prop><A:current-user-principal/></A:prop></A:propfind>"
        },
        function(error, response, body){
            if(error){ return false; }

            //todo: validate response

            var user_id = parseInt(getBetween(getBetween(body, "<current-user-principal>", "</current-user-principal>"), "<href>", "</href>").split("/")[1]);
            if(user_id){
                user = {
                    id: user_id,
                    username: username,
                    password: password
                };
            }

            callback.call(this, user_id);
        }
        );
    },
    addEvent: function(cal, uid, time_start, time_end, description, location, title, callback){
        if(user == null){
            throw new Error("Login required");
        }

        var payload = [];
        payload.push("BEGIN:VCALENDAR");
        payload.push("VERSION:2.0");
        payload.push("BEGIN:VEVENT");
        payload.push("DTSTAMP:"+time_start);
        payload.push("DTSTART:"+time_start);
        payload.push("DTEND:"+time_end);
        payload.push("UID:"+uid);
        payload.push("DESCRIPTION:"+description);
        payload.push("LOCATION:"+location);
        payload.push("SUMMARY:"+title);
        payload.push("END:VEVENT");
        payload.push("END:VCALEND");

        request(
            {
                method: 'PUT',
                uri: 'https://p01-caldav.icloud.com'+ cal + uid + ".ics",
                auth: {
                    'user': user.username,
                    'pass': user.password,
                    'sendImmediately': true
                },
                headers: {
                    "Content-Type": "text/calendar",
                    "User-Agent": "DAVKit/4.0.1 (730); EALSchedule/1.0.0 (100); iCal/4.0.1 (1374); Mac OS X/10.6.2 (10C540)"
                },
                body: payload.join("\r\n")
            },
            function(error, response, body){
                if(callback){
                    //todo: check body for error codes (error is only if request fails, duplicate item (uid) e.g.)
                    callback.call(this, error, body);
                }
            }
        );
    },
    getEvent: function(uid){
        if(user == null){
            throw new Error("Login required");
        }
        //todo: make this method.
    },
    removeEvent: function(uid){
        if(user == null){
            throw new Error("Login required");
        }
        //todo: make this method.
    },
    getCalendars: function(callback){
        if(user == null){
            throw new Error("Login required");
        }
        request(
            {
                method: 'PROPFIND',
                uri: 'https://p01-caldav.icloud.com/' + user.id + '/calendars/',
                auth: {
                    'user': user.username,
                    'pass': user.password,
                    'sendImmediately': true
                },
                headers: {
                    "Depth": 1,
                    "Content-Type": "text/xml; charset='UTF-8'",
                    "User-Agent": "DAVKit/4.0.1 (730); EALSchedule/1.0.0 (100); iCal/4.0.1 (1374); Mac OS X/10.6.2 (10C540)"
                },
                body: "<A:propfind xmlns:A='DAV:'><A:prop><A:displayname/></A:prop></A:propfind>"
            },
            function(error, response, body){
                if(error){ return false; }
                var json = JSON.parse(parser.toJson(body));
                var items = {};
                json.multistatus.response.forEach(function(item){
                    if(item.propstat && item.propstat.status == 'HTTP/1.1 200 OK')
                        if(item.href.split("/").length > 4){
                            items[item.propstat.prop.displayname] = item.href;
                        }
                });
                callback.call(this, items);
            }
        );
    },
    formatDateTime: function(date, time){ //yyyymmdd hhmm
        var d = new Date();
        d.setFullYear(date.toString().substr(0,4));
        d.setMonth(date.toString().substr(4,2)-1);
        d.setDate(date.toString().substr(6,2));
        d.setHours(time.toString().substr(0,2));
        d.setMinutes(time.toString().substr(2,2));
        d.setSeconds(0);

        return d.toISOString().split("-").join("").split(":").join("").split(".")[0] + "Z";
    }


};
