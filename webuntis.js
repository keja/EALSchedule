var request = require('request');

function getMonday(d) {
    d = new Date(d);
    var day = d.getDay(),
        diff = d.getDate() - day + (day == 0 ? -6 : 1);
    return new Date(d.setDate(diff));
}
function pad(n, width, z) {
    z = z || '0';
    n = n + '';
    return n.length >= width ? n : new Array(width - n.length + 1).join(z) + n;
}

var untis_service = 'https://eal.webuntis.dk/WebUntis/Timetable.do';
module.exports = {
    setURL: function(url){
        untis_service = url;
    },
    fetchWeek: function(date, id, callback){

        var day = getMonday(date),
            data = {
                ajaxCommand: "getWeeklyTimetable",
                elementType: 1,
                elementId: id,
                date: [day.getFullYear(), pad(day.getMonth()+1, 2), pad(day.getDate(), 2)].join("")
            };

        //wget --post-data "ajaxCommand=getWeeklyTimetable&elementType=1&elementId=997&date=20160201" https://eal.webuntis.dk/WebUntis/Timetable.do
        request.post({ url: untis_service, form: data }, function(err, httpResponse){
            if(err){ return; }
            if(httpResponse.statusCode == 200){

                var json = JSON.parse(httpResponse.body),
                    element_id = Object.keys(json.result.data.elementPeriods)[0],
                    types = [];

                //todo: validate json

                json.result.data.elements.forEach(function(element){
                    if(typeof types[element.type] == "undefined"){
                        types[element.type] = [];
                    }
                    types[element.type][element.id] = element;
                });

                //due to more entities if there is more than one teacher teaching the same specific class (1x teacher = 1x entity) - merge events.
                var events = {};
                json.result.data.elementPeriods[element_id].forEach(function(period){

                    var event = {};
                    event.time_start    = pad(period.startTime, 4);
                    event.time_end      = pad(period.endTime, 4);
                    event.date          = period.date;
                    event.uid           = "k-" + element_id + "-" + event.date + "-" + event.time_start + "-" + event.time_end;
                    event.title         = typeof events[event.uid] == "undefined" ? [] : events[event.uid].title;
                    event.zone          = typeof events[event.uid] == "undefined" ? [] : events[event.uid].zone;
                    event.teacher       = typeof events[event.uid] == "undefined" ? [] : events[event.uid].teacher;
                    events[event.uid]   = event;

                    period.elements.forEach(function(element){
                        if(typeof types[element.type][element.id].longName == "undefined"){
                            return false;
                        }
                        switch(element.type){
                            case 2: events[event.uid].teacher.push  (types[element.type][element.id].longName); break;
                            case 3: events[event.uid].title.push    (types[element.type][element.id].longName); break;
                            case 4: events[event.uid].zone.push     (types[element.type][element.id].longName); break;
                        }
                    });
                });

                //run through merged events.
                callback.call(this, events);


            }

        });
    },
    fetchClasslist: function(callback){
        var data = {
                ajaxCommand: "getPageConfig",
                type: 1,
                formatId: 2
            };
        request.post({ url: untis_service, form: data }, function(err, httpResponse) {
            if (err) { return; }
            if (httpResponse.statusCode == 200) {
                var list = {},
                    json = JSON.parse(httpResponse.body);

                json.elements.forEach(function(element){
                    list[element.displayname.toLowerCase()] = element.id;
                });
                callback.call(this, list);
            }
        });
    }
};
