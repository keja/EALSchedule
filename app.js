var webuntis = require("./webuntis.js"),
    icloud = require("./icloud.js"),
    prompt = require("prompt"),
    colors = require("colors/safe"),
    ProgressBar = require('progress'),
    async = require('async');


webuntis.setURL('https://eal.webuntis.dk/WebUntis/Timetable.do');

prompt.start();

//Prompts
var icloudSchema = [
{
    name: 'username',
    required: true,
    message: 'username is required',
    description: 'icloud username'
},
{
    name: 'password',
    hidden: true,
    replace: '*',
    required: true,
    message: 'password is required',
    description: 'icloud password'
}
];
var calSchema = {
    name: 'index',
    required: true,
    message: 'Only numbers',
    pattern: /^[1-9]+$/,
    description: 'Calendar to use for school schedule, enter number'
    //message and conform set at line 125
};
var weekSchema = {
    name: 'weeks',
    description: 'How many weeks would you like to add to the calendar?',
    message: 'Numbers only',
    pattern: /^[0-9]+$/,
    required: true,
    default: 4
};
var classSchema = {
    name: 'class_id',
    description: 'Enter your classname',
    message: 'Could not find that class',
    required: true,
    default: 'opbwu16fint'
    //conform and before - defined on line 141
};


Date.prototype.getWeek = function(weekStart) {
    var januaryFirst = new Date(this.getFullYear(), 0, 1);
    if(weekStart !== undefined && (typeof weekStart !== 'number' || weekStart % 1 !== 0 || weekStart < 0 || weekStart > 6)) {
        throw new Error('Wrong argument. Must be an integer between 0 and 6.');
    }
    weekStart = weekStart || 0;
    return Math.floor((((this - januaryFirst) / 86400000) + januaryFirst.getDay() - weekStart) / 7);
};

var EventQueue = async.queue(function(task, callback) {
    var event = task.event;
    var start = icloud.formatDateTime(event.date, event.time_start);
    var end = icloud.formatDateTime(event.date, event.time_end);
    if(!event.title.length){ event.title.push("untitled"); }
    var description = event.title[0] + " with " + (event.teacher.length ? event.teacher.join(", ") : "unknown") + " at " + (event.zone.length ? event.zone[0] : "who knows?");
    if(!event.zone.length){ event.zone.push(""); }

    icloud.addEvent(task.cal_ref, event.uid, start, end, description, event.zone[0], event.title[0], function(err, res){
        if(!err){
            callback(res);
        }else{
            console.error(err);
        }
    });

}, 1);

var WeekQueue = async.queue(function (task, callback) {
    webuntis.fetchWeek(task.week, task.class_id, function(events){
        for(var e in events){
            var bar = new ProgressBar((task.index+1) + '/' + task.weeks + ': Adding events for week ' + task.week.getWeek(1) + ' [:bar] :current/:total', {
                complete: '#',
                incomplete: ' ',
                width: 50,
                total: Object.keys(events).length
            });
            EventQueue.push({event: events[e], cal_ref: task.cal}, function(err, res){
                bar.tick();
            });
        }
        EventQueue.resume();
        callback();
    });
    WeekQueue.pause();
}, 1);

EventQueue.drain = function() {
    WeekQueue.resume();
};



function app() {
    prompt.get(icloudSchema, function (err, result) {
        if (err) {
            return;
        }
        icloud.login(result.username, result.password, function (success) {
            if (success) {

                icloud.getCalendars(function(calendars) {
                    var i = 1,
                        index = [];

                    console.log("Available calenders:")
                    Object.keys(calendars).forEach(function(c) {
                        index[i] = c;
                        console.log(i++ + " - " + c);
                    });
                    console.log("");

                    calSchema.message = 'Only numbers between 1 and ' + (i-1);
                    calSchema.conform = function(value){ return value > 0 && value <= i };

                    prompt.get(calSchema, function(err, result){
                        if(err) { return; }
                        var cal_ref = calendars[index[result.index]];

                        prompt.get(weekSchema, function(err, result){
                            if(err){ return; }
                            var weeks = [],
                                today = new Date();

                            for(var i=0; i<result.weeks; i++){
                                weeks.push(new Date(today.getTime() + (i*7) * 24 * 60 * 60 * 1000));
                            }
                            webuntis.fetchClasslist(function(c){
                                classSchema.conform = function(value) { return typeof c[value.toString().toLowerCase()] != "undefined" };
                                classSchema.before = function(value) { return c[value.toString().toLowerCase()]; };

                                prompt.get(classSchema, function(err, result){
                                    if(err) { return; }
                                    //console.log(result.class_id, cal_ref, weeks.length);
                                    console.log("");

                                    weeks.forEach(function(week, index){
                                        WeekQueue.push({index: index, weeks: weeks.length, week: week, class_id: result.class_id, cal: cal_ref});
                                    });
                                    WeekQueue.resume();

                                }); //classSchema
                            });//webuntis.fetchClasslist
                        }); //weekSchema
                    }); //calSchema
                }); //icloud.getCalendars

            } else {
                console.log(colors.red("error") + colors.green(": failed to login"));
                app(); //restart app
            }
        });
    });
}

app();
