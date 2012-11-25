
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , user = require('./routes/user')
  , http = require('http')
  , path = require('path');

var mysql = require('mysql');
var connection = mysql.createConnection({
                                        host : 'mysql-user-master.stanford.edu',
                                        user : 'ccs147vinster',
                                        password : 'fiepheej',
                                        database : 'c_cs147_vinster',
});
connection.connect();

var app = express();

app.configure(function(){
  app.set('port', process.env.PORT || 3000);
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser('your secret here'));
  app.use(express.session());
  app.use(app.router);
  app.use(require('stylus').middleware(__dirname + '/public'));
  app.use(express.static(path.join(__dirname, 'public')));
});

//variables that hold sessions
var _sessions = {};

//variable that holds global posts
var globalPosts = [];

var globalAnalytics = [
  {}
]
// end dummy data

app.configure('development', function(){
  app.use(express.errorHandler());
});


// routes
app.get('/', routes.home);
app.get('/global', function(req, res) {
        res.render('global', {statuses: JSON.stringify(globalPosts)})
        })

app.get('/globalanalytics', function(req, res) {
  res.write(JSON.stringify(globalPosts))
  res.end()
})

app.get('/settings', routes.settings) 
app.get('/personal', function(req, res) {
//    if (_sessions[req.sessionID].user == undefined) {
//        res.render('login');
//    } else {
        res.render('personal', {statuses: JSON.stringify(_sessions[req.sessionID].personalPosts)})
//    }
}
)
app.get('/addStatus', routes.addStatus);
app.get('/login', function(req, res) {
        console.log(req.sessionID);
        if (_sessions[req.sessionID] != undefined) {
        res.render('personal', {statuses: JSON.stringify(_sessions[req.sessionID].personalPosts)})
        } else {
        res.render('login');
        }
        })
app.get('/logout', function(req, res) {
        delete _sessions[req.sessionID];
        globalPosts = [];
        globalAnalytics = [
        {}
        ]
        res.render('login', {loggedout: 1});
        });

app.get('/createProfile', routes.createProfile);
app.post('/create-profile', function(req, res) {
    var params = req.body;
    //If email has invalid format, refresh page
    if (params.email.indexOf('@') == -1) {
        res.render('createProfile', {invalid: 'emailFormat'});
    } else {
        //If email isn't already in Profiles database proceed
        connection.query('SELECT COUNT(*) from Profiles WHERE email = ?', params.email, function(err, rows) {
            if (err) throw err;
            if (rows[0]['COUNT(*)'] == 0) {
                //Insert new user into Profiles database
                connection.query('INSERT INTO Profiles SET ?', params, function(err, result) {
                    if (err) throw err;
                    params.privacy = 'friends'; //STATIC
                    params.location = 'on'; //STATIC
                                 _sessions[req.sessionID] = {}
                    _sessions[req.sessionID].user = params;
                    _sessions[req.sessionID].personalPosts = [];
                    //Render personalFeed page
                    connection.query('SELECT * from Statuses ORDER BY date DESC', function(err, rows) {
                        globalPosts = rows;
                    })
                    res.render('personal', {statuses: JSON.stringify(_sessions[req.sessionID].personalPosts)});
                });   
            } else {
                //Refresh page if email already exists
                res.render('createProfile', {invalid: 'emailExists'});
            }
        });
    }
})

app.post('/attempt-login', function(req, res) {
    var params = req.body;
    //If credentials are in the Profile database, continue
    connection.query('SELECT * from Profiles WHERE email = ? AND password = ?', [params.email, params.password], function(err, rows) {     
        if (rows.length == 1) {
            _sessions[req.sessionID] = {}
            _sessions[req.sessionID].user = rows[0];
            //Get the all of the users statuses
                     connection.query('SELECT * from Statuses ORDER BY date DESC', function(err, rows) {
                                      globalPosts = rows;
                                      })
            connection.query('SELECT * from Statuses WHERE email = ? ORDER BY date DESC', params.email, function(err, rows) {
                _sessions[req.sessionID].personalPosts = rows;
                //render personalFeed page
                res.render('personal', {statuses: JSON.stringify(_sessions[req.sessionID].personalPosts)});

            })
        } else {
            //Refresh page if login fail
            res.render('login', {invalid: 1});
        }
    })
})

app.post('/save-settings', function(req, res) {
  var params = req.body;

  _sessions[req.sessionID].user['name'] = params['name']
  _sessions[req.sessionID].user['email'] = params['email']
  if(params['pass']) _sessions[req.sessionID].user['password'] = params['pass']
  _sessions[req.sessionID].user['gender'] = params['gender']
  _sessions[req.sessionID].user['privacy'] = params['privacy']
  _sessions[req.sessionID].user['location'] = params['flip-s']

  res.render('global', {statuses: JSON.stringify(globalPosts)})
}) 

app.get('/user-info', function(req, res) {
  res.write(JSON.stringify(_sessions[req.sessionID].user))
  res.end()
})

app.get('/users', user.list);

app.post('/postStatus', function(req, res) {
    var params = req.body;
    var status = {};
    status['email'] = _sessions[req.sessionID].user.email;
    status['status'] = params['textarea'];
    var emotion = params['e-radio-choice'];
    if (emotion == 'choice-1') {
        status['emotion'] = 'excited';
    } else if (emotion == 'choice-2') {
        status['emotion'] = 'neutral';
    } else if (emotion == 'choice-3') {
        status['emotion'] = 'angry';
    } else if(emotion == 'choice-4') {
        status['emotion'] = 'happy'
    } else if(emotion == 'choice-5') {
        status['emotion'] = 'sad'
    } else if(emotion == 'choice-6') {
        status['emotion'] = 'angel'
    } else if(emotion == 'choice-7') {
        status['emotion'] = 'devil'
    } else if(emotion == 'choice-8') {
        status['emotion'] = 'disappoint'
    } else if(emotion == 'choice-9') {
        status['emotion'] = 'laugh'
    } else {
        status['emotion'] = 'surprised'
    }

    status['date'] = new Date();
    status['privacy'] = 'public'; //STATIC
    status['location'] = params['location'];
    if(params['image']) status['image'] = params['image'];
    else status['image'] = 'none'

    //Add status to globalPosts array and personalPosts array
    globalPosts.unshift(status);
    _sessions[req.sessionID].personalPosts.unshift(status);
    
    //Add status to the database
    connection.query('INSERT INTO Statuses SET ?', status, function(err, result) {
        if (err) throw err;
        res.render('personal', {statuses: JSON.stringify(_sessions[req.sessionID].personalPosts)});
    });   
});

http.createServer(app).listen(app.get('port'), function(){
  console.log("Express server listening on port " + app.get('port'));
});
