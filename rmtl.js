/*
*	Main file for the RMTL Equipment Booking System. 
*   Developed by: Brandon Tang, Jason Lee, Sarah Nowlan, Tayyab Ahmad, Will Xie 
*   Last updated: 6/28/2020
*/

// npm packages 
var mysql = require('mysql');
var express = require('express');
var session = require('express-session');
var bodyParser = require('body-parser');
var path = require('path');
var bcrypt = require('bcrypt');
var async = require('async');
var ejs = require('ejs');
var fs = require('fs');
var MySQLStore = require('express-mysql-session')(session);
var nodemailer = require('nodemailer');

// bcrypt hashing iterations
const saltRounds = 10;

// UPDATES REQUIRED - update host, user, password, and database
// configure database credentials 
var connection = mysql.createConnection({
	host     : 'localhost',		// server address
	user     : 'user',			// mysql username
	password : 'password',		// mysql password
	database : 'production'		// database name
});

var app = express();

// UPDATES REQUIRED - update filepaths while keeping filename 
// filepath to MySQL uploads folder
var maintenanceFILE = 'C:/ProgramData/MySQL/MySQL Server 8.0/Uploads/New-Maintenance-Report.csv';
var logFILE = 'C:/ProgramData/MySQL/MySQL Server 8.0/Uploads/New-Log.csv';

// set EJS as template engine
app.set('view engine', 'ejs');

// UPDATES REQUIRED - update host, port, user, password, and database
// session store settings 
var options = {
	host: 'localhost',		// server address
	port: 3306,				// port 	
	user: 'user',			// mysql username
	password: 'password', 	// mysql password
	database: 'production',		// database name 
	expiration: 3600000, 	// session expiration time (in ms)
	checkExpirationInterval: 600000,	// intervals for check for expired cookies (in ms) 
	endConnectionOnClose: true
};

var sessionStore = new MySQLStore(options);

// configure express-session settings
app.use(session({
	secret: 'change_this_variable,			
	resave: false,
	saveUninitialized: false, 
	name: "rmtl_user",			
	store: sessionStore		
}));

// configure body parser 
app.use(bodyParser.urlencoded({extended : true}));
app.use(bodyParser.json());

// static filepaths
app.use(express.static(__dirname + '/images'));
app.use(express.static(__dirname + '/css'));

// load first visible page (login)
app.get('/', function(request, response) {
	response.render(path.join(__dirname + '/views/login.ejs'), { message: "\xa0"});
});

app.get('/forgot-credentials', function(request, response) { 
    response.render(path.join(__dirname + '/views/forgot-credentials.ejs'));
});

app.post('/forgot-credentials', function(request, response) {
    var email = JSON.stringify(request.body.email);
	
	// UPDATES REQUIRED - update 'user' and 'pass'
	// email credentials
	var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'email_address',		// email address
            pass: 'email_password'		// password
        }
	});
	
	// UPDATES REQUIRED - update 'to'
	// setup email contents
    var mailOptions = {
        from: 'email_address',
        to: 'email_address',			// email address to recieve system notifications 
        subject: email.concat(' needs assistance logging in!'),
        text: 'Please email the username and reset password for '.concat( email)
    };
	  
	// send email 
    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            response.status(500).send(error);
        } 
	});

	response.redirect('/login');
    response.end();
});

app.get('/request-account', function(request, response) { 
    response.render(path.join(__dirname + '/views/request-account.ejs'));
});

app.post('/request-account', function(request, response) { 
    var email = JSON.stringify(request.body.email);
    var first_name = (request.body.fname);
    var last_name = (request.body.lname);
    var full_name = JSON.stringify(first_name.concat(" " + last_name));

	// UPDATES REQUIRED - user and pass 
	// email credentials
    var transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: 'email_address,		// email address
            pass: 'email_password'		// password
        }
    });
	  
	// UPDATES REQUIRED - to 
	// setup email contents
    var mailOptions = {
        from: 'email_address',
        to: 'email_address',			// email address to recieve system notifications
        subject: full_name.concat(" is requesting an account!"),
        text: 'Please create an account for '.concat(full_name + " with email " + email)
    };
	
	// send email 
    transporter.sendMail(mailOptions, function(error, info){
        if (error) {
            response.status(500).send(error);
        } 
	});

	response.redirect('/login');
	response.end();
});

app.get('/login', function(request, response) { 
	response.render(path.join(__dirname + '/views/login.ejs'), {message: "\xa0"});
});

// render user homepage with announcements
app.get('/homepage', authenticate, function(request, response) { 
	connection.query('SELECT * FROM announcements ORDER BY posted;', function(error, results, fields) {
		try {
			if (results.length > 0) { 
				response.render(path.join(__dirname + '/views/homepage.ejs'), {data: results});
			} else { 
				throw "ERROR: EJS template error due to empty announcement board.";
			}
		} catch (error) { 
			response.status(400).send(error);
		}
	});
});

// load report issues page for users 
app.get('/report-issues', authenticate, function(request,response) {
	var username = request.session.username;
	// get information
	async.parallel({
		// get equipment list
		equipment: function (callback) {
			connection.query('SELECT * FROM equipment;', callback);
		},
		// get past reports
		past: function (callback) {
			connection.query('SELECT * FROM maintenancereport WHERE user = ? ORDER BY submitted DESC;', [username], callback);
		}
	},
	function (error, results) {
		response.render(path.join(__dirname + '/views/report-issues.ejs'), { equipment: results.equipment[0], past: results.past[0]});
	});
});

// submit reported issue from user
app.post('/report-issues', authenticate, function(request,response) {
	// get information
	var username = request.session.username;
	var equipment = request.body.equipment;
	var urgency = request.body.urgency;
	var description = request.body.description;
	var date = new Date();
	date = new Date(date - date.getTimezoneOffset() * 60000);
	date = date.toISOString().slice(0, 19).replace('T', ' ');
	// submit report
	if(equipment && urgency && description)
	{
		connection.query('INSERT INTO maintenancereport VALUES (?, ?, ?, ?, ?, "Pending", NULL);', [username, equipment, date, description, urgency], function (error, results, fields) {
			if (error) {
				return connection.rollback(function() {
					throw error;
				});
			}
		});
		response.redirect('/report-issues');
	}
});

// manager report equipment issues page
app.get('/manager-report-issues', authenticateAdmin, function(request,response) {
	var username = request.session.username;
	// get information
	async.parallel({
		// get equipment list
		equipment: function (callback) {
			connection.query('SELECT * FROM equipment;', callback);
		},
		// get past reports
		past: function (callback) {
			connection.query('SELECT * FROM maintenancereport WHERE user = ? ORDER BY submitted DESC;', [username], callback);
		}
	},
	function (error, results) {
		response.render(path.join(__dirname + '/views/manager-report-issues.ejs'), { equipment: results.equipment[0], past: results.past[0]});
	});
});

// manager make new report page
app.post('/manager-report-issues', authenticateAdmin, function(request,response) {
	// get information
	var username = request.session.username;
	var equipment = request.body.equipment;
	var urgency = request.body.urgency;
	var description = request.body.description;
	var date = new Date();
	date = new Date(date - date.getTimezoneOffset() * 60000);
	date = date.toISOString().slice(0, 19).replace('T', ' ');
	// submit report
	if(equipment && urgency && description)
	{
		connection.query('INSERT INTO maintenancereport VALUES (?, ?, ?, ?, ?, "Pending", NULL);', [username, equipment, date, description, urgency], function (error, results, fields) {
			if (error) {
				return connection.rollback(function() {
					throw error;
				});
			}
		});
		response.redirect('/manager-report-issues');
	}
});

// manager view reports page
app.get('/manager-reports', authenticateAdmin, function(request,response) {
	// get reports
	async.parallel({
		pending: function (callback) {
			connection.query('SELECT * FROM maintenancereport WHERE activity = "Pending" ORDER BY submitted DESC;', callback);
		},
		progress: function (callback) {
			connection.query('SELECT * FROM maintenancereport WHERE activity = "Confirmed" ORDER BY submitted DESC;', callback);
		},
		resolved: function (callback) {
			connection.query('SELECT * from maintenancereport WHERE activity = "Resolved" ORDER BY submitted DESC;', callback);
		}
	},
	function (error, results) {
		response.render(path.join(__dirname + '/views/manager-reports.ejs'), { pending: results.pending[0], progress: results.progress[0], resolved: results.resolved[0]});
	});
});

// modify pending reports
app.post('/modify-pending', authenticateAdmin, function (request, response) {
	var select = request.body.select;
	var button = request.body.button;
	var date = new Date();
	date = new Date(date - date.getTimezoneOffset() * 60000);
	date = date.toISOString().slice(0, 19).replace('T', ' ');
	// move to confirmed
	if (button == "progress" && select) {
		for(var x = 0; x < select.length; x++) {
			values = select[x].split('$');
			theDate = new Date(values[1]);
			theDate = new Date(theDate - theDate.getTimezoneOffset() * 60000);
			theDate = theDate.toISOString().slice(0, 19).replace('T', ' ');
			connection.query('UPDATE maintenancereport SET activity="Confirmed" WHERE equipmentName = ? AND submitted = ?;', [values[0], theDate], function (error, results, fields) {
				if (error) {
					return connection.rollback(function() {
						throw error;
					});
				}
			});
		}
	// move to resolved
	} else if (button == "resolved" && select) {
		for(var x = 0; x < select.length; x++) {
			values = select[x].split('$');
			theDate = new Date(values[1]);
			theDate = new Date(theDate - theDate.getTimezoneOffset() * 60000);
			theDate = theDate.toISOString().slice(0, 19).replace('T', ' ');
			connection.query('UPDATE maintenancereport SET activity="Resolved", fixedOn = ? WHERE equipmentName = ? AND submitted = ?;', [date, values[0], theDate], function (error, results, fields) {
				if (error) {
					return connection.rollback(function() {
						throw error;
					});
				}
			});
		}
	} else if (button == "delete" && select) {
		for(var x = 0; x < select.length; x++) {
			values = select[x].split('$');
			theDate = new Date(values[1]);
			theDate = new Date(theDate - theDate.getTimezoneOffset() * 60000);
			theDate = theDate.toISOString().slice(0, 19).replace('T', ' ');
			connection.query('DELETE FROM maintenancereport WHERE equipmentName = ? AND submitted = ?;', [values[0], theDate], function (error, results, fields) {
				if (error) {
					return connection.rollback(function() {
						throw error;
					});
				}
			});
		}
	}
	response.redirect('/manager-reports');
});

// render manager homepage with announcements
app.get('/manager-homepage', authenticateAdmin, function(request, response) { 
	connection.query('SELECT * FROM announcements ORDER BY posted;', function(error, results, fields) {
		try {
			if (results.length > 0) { 
				response.render(path.join(__dirname + '/views/manager-homepage.ejs'), {data: results});
			} else { 
				throw "ERROR: Unable to load manager homepage.";
			}
		} catch (error) { 
			response.status(400).send(error);
		}
	});
});

// add new announcement to display to all users
app.post('/add-announcement', authenticateAdmin, function(request, response) { 
	
	// announcement contents
	var title = request.body.title; 
	var body = request.body.body; 
	title.trim();
	body.trim(); 
	
	if (title.length > 50) { 
		throw "ERROR: Announcement title exceeds permitted length of 50 characters.";
	}
	if (body.length > 500) { 
		throw "ERROR: Announcement contents exceeds permitted length of 500 characters.";
	}

	// add announcement to database 
	connection.query('INSERT INTO announcements (title, content, posted) VALUES (?,?,NOW());', [title, body], function(error, results, fields) {
		try { 
			if (error) { 
				throw "ERROR: Unable to add new announcement.";
			} else { 
				response.redirect('/manager-homepage');
			}
		} catch (error) { 
			response.status(400).send(error);
		}
	});
});	

// delete selected announcements from the announcement board 
app.post('/delete-announcement', authenticateAdmin, function(request, response) {
	var selected = request.body.select; 

	if (typeof selected == 'string') { 
		selected = [selected];
	}

	// no selection made, redirect to previous page
	if (typeof selected == 'undefined') { 
		response.redirect('/manager-homepage');
	} else { 
		try { 
			// iterate and delete selected announcements
			async.forEachOf(selected, function(value, key, callback) { 
				connection.query('DELETE FROM announcements WHERE id = ?', [selected[key]], function(error, results, fields) {
					if (error) { 
						throw "ERROR: Unable to delete announcement.";
					}
				});
			});
			response.redirect('/manager-homepage');
		} catch (error) { 
			response.status(400).send(error);
		}
	}
});

// modify in progress reports
app.post('/modify-progress', authenticateAdmin, function (request, response) {
	var select = request.body.select;
	var button = request.body.button;
	var date = new Date();
	date = new Date(date - date.getTimezoneOffset() * 60000);
	date = date.toISOString().slice(0, 19).replace('T', ' ');
	// move to resolved
	if (button == "resolved" && select) {
		for(var x = 0; x < select.length; x++) {
			values = select[x].split('$');
			theDate = new Date(values[1]);
			theDate = new Date(theDate - theDate.getTimezoneOffset() * 60000);
			theDate = theDate.toISOString().slice(0, 19).replace('T', ' ');
			connection.query('UPDATE maintenancereport SET activity="Resolved", fixedOn = ? WHERE equipmentName = ? AND submitted = ?;', [date, values[0], theDate], function (error, results, fields) {
				if (error) {
					return connection.rollback(function() {
						throw error;
					});
				}
			});
		}
	// move to pending
	} else if (button == "pending" && select) {
		for(var x = 0; x < select.length; x++) {
			values = select[x].split('$');
			theDate = new Date(values[1]);
			theDate = new Date(theDate - theDate.getTimezoneOffset() * 60000);
			theDate = theDate.toISOString().slice(0, 19).replace('T', ' ');
			connection.query('UPDATE maintenancereport SET activity="Pending" WHERE equipmentName = ? AND submitted = ?;', [values[0], theDate], function (error, results, fields) {
				if (error) {
					return connection.rollback(function() {
						throw error;
					});
				}
			});
		}
	} else if (button == "delete" && select) {
		for(var x = 0; x < select.length; x++) {
			values = select[x].split('$');
			theDate = new Date(values[1]);
			theDate = new Date(theDate - theDate.getTimezoneOffset() * 60000);
			theDate = theDate.toISOString().slice(0, 19).replace('T', ' ');
			connection.query('DELETE FROM maintenancereport WHERE equipmentName = ? AND submitted = ?;', [values[0], theDate], function (error, results, fields) {
				if (error) {
					return connection.rollback(function() {
						throw error;
					});
				}
			});
		}
	}
	response.redirect('/manager-reports');
}); 

// modify resolved reports
app.post('/modify-resolved', authenticateAdmin, function (request, response) {
	var select = request.body.select;
	var button = request.body.button;
	// move to fix in progress
	if (button == "progress" && select) {
		for(var x = 0; x < select.length; x++) {
			values = select[x].split('$');
			theDate = new Date(values[1]);
			theDate = new Date(theDate - theDate.getTimezoneOffset() * 60000);
			theDate = theDate.toISOString().slice(0, 19).replace('T', ' ');
			connection.query('UPDATE maintenancereport SET activity="Confirmed" WHERE equipmentName = ? AND submitted = ?;', [values[0], theDate], function (error, results, fields) {
				if (error) {
					return connection.rollback(function() {
						throw error;
					});
				}
			});
		}
	// move to pending
	} else if (button == "pending" && select) {
		for(var x = 0; x < select.length; x++) {
			values = select[x].split('$');
			theDate = new Date(values[1]);
			theDate = new Date(theDate - theDate.getTimezoneOffset() * 60000);
			theDate = theDate.toISOString().slice(0, 19).replace('T', ' ');
			connection.query('UPDATE maintenancereport SET activity="Pending" WHERE equipmentName = ? AND submitted = ?;', [values[0], theDate], function (error, results, fields) {
				if (error) {
					return connection.rollback(function() {
						throw error;
					});
				}
			});
		}
	} else if (button == "delete" && select) {
		for(var x = 0; x < select.length; x++) {
			values = select[x].split('$');
			theDate = new Date(values[1]);
			theDate = new Date(theDate - theDate.getTimezoneOffset() * 60000);
			theDate = theDate.toISOString().slice(0, 19).replace('T', ' ');
			connection.query('DELETE FROM maintenancereport WHERE equipmentName = ? AND submitted = ?;', [values[0], theDate], function (error, results, fields) {
				if (error) {
					return connection.rollback(function() {
						throw error;
					});
				}
			});
		}
	}
	response.redirect('/manager-reports');
}); 

// regular user profile page
app.get('/profile', authenticate, function(request,response) { 
	var username = request.session.username;

	// get user information
	async.parallel({
		user: function (callback) {
			connection.query('SELECT * FROM users WHERE username = ?;', [username], callback);
		},
		training: function (callback) {
			connection.query('SELECT DISTINCT equipmentName FROM inGroup INNER JOIN trainedFor ON inGroup.groupName = trainedFor.groupName WHERE username = ?;', [username], callback);
		},
		projects: function (callback) {
			connection.query('SELECT * from worksOn WHERE username = ?;', [username], callback);
		}
	},
	function (error, results) {
		response.render(path.join(__dirname + '/views/profile.ejs'), { user: results.user[0], training: results.training[0], projects: results.projects[0], message: "\xa0" });
	});
});

// verify user password page
app.get('/profile-verify', authenticate, function (request, response) {
	var username = request.session.username;
	// get user information
	connection.query('SELECT * FROM users WHERE username = ?;', [username], function (error, results, fields) {
		response.render(path.join(__dirname + '/views/profile-verify.ejs'), { user: results, message: "\xa0" });
	});
});

// verify user password before profile changes
app.post('/profile-verify', authenticate, function (request, response) {
	var username = request.session.username;
	var password = request.body.password;
	// password entered
	if (password) {
		connection.query('SELECT * FROM users WHERE username = ?', [username], function (error, results, fields, ) {
			// get stored hashed password
			var dbpass = results[0].password;

			// compare hashed passwords
			bcrypt.compare(password, dbpass, function (error, result) {

				// if passwords match 
				if (result) {
					// redirect to update information page
					response.redirect('/profile-update');
				} else {
					response.render(path.join(__dirname + '/views/profile-verify.ejs'), { message: "Password incorrect" });
				}
			});
		});
	// password not entered
	} else {
		response.render(path.join(__dirname + '/views/profile-verify.ejs'), { message: "Please enter your password" });
	}
}); 

// update user profile page
app.get('/profile-update', authenticate, function (request, response) {
	var username = request.session.username;
	connection.query('SELECT * FROM users WHERE username = ?;', [username], function (error, results, fields) {
		response.render(path.join(__dirname + '/views/profile-update.ejs'), { user: results });
	});
});

// check changes and update user profile
app.post('/profile-update', authenticate, function (request, response) {
	var username = request.session.username;
	var password = request.body.password;
	var email = request.body.email;

	// update database email
	if (email) {
		connection.query('UPDATE users SET email = ? WHERE username = ?;', [email, username], function (error, results, fields, ) {
			if (error) {
				response.render(path.join(__dirname + '/views/profile.ejs'), { confirm: "An error has occurred. Your email has not been changed." });
				return connection.rollback(function() {
					throw error;
				});
			}
		});
	}
	// update database hashed password
	if (password.length > 0)
	{ 
		bcrypt.hash(password, saltRounds, function(error, hash) { 
			connection.query('UPDATE users SET password = ? WHERE username = ?;', [hash, username], function(error, results, fields) {
				if (error) {
					response.render(path.join(__dirname + '/views/profile.ejs'), { confirm: "An error has occurred. Your password has not been changed." });
					return connection.rollback(function() {
						throw error;
					});
				}
				response.redirect('/profile');
			});
		});
	}
	else {response.redirect('/profile');}
}); 

// manager profile page
app.get('/manager-profile', authenticateAdmin, function (request, response) {
	var username = request.session.username;

	// get user information
	connection.query('SELECT * FROM users WHERE username = ?;', [username], function (error, results, fields) {
		response.render(path.join(__dirname + '/views/manager-profile.ejs'), { user: results, message: "\xa0" });
	});
}); 

// verify manager password page
app.get('/manager-profile-verify', authenticateAdmin, function (request, response) {
	response.render(path.join(__dirname + '/views/manager-profile-verify.ejs'), { message: "\xa0" });
});

// verify manager password before profile changes
app.post('/manager-profile-verify', authenticateAdmin, function (request, response) {
	var username = request.session.username;
	var password = request.body.password;
	// password entered
	if (password) {
		connection.query('SELECT * FROM users WHERE username = ?', [username], function (error, results, fields, ) {
			// get stored hashed password
			var dbpass = results[0].password;

			// compare hashed passwords
			bcrypt.compare(password, dbpass, function (error, result) {

				// if passwords match 
				if (result) {
					// redirect to update information page
					response.redirect('/manager-profile-update');
				} else {
					response.render(path.join(__dirname + '/views/manager-profile-verify.ejs'), { message: "Password incorrect" });
				}
			});
		});
	// password not entered
	} else {
		response.render(path.join(__dirname + '/views/manager-profile-verify.ejs'), { message: "Please enter your password" });
	}
}); 

// update manager profile page
app.get('/manager-profile-update', authenticateAdmin, function (request, response) {
	var username = request.session.username;
	connection.query('SELECT * FROM users WHERE username = ?;', [username], function (error, results, fields) {
		response.render(path.join(__dirname + '/views/manager-profile-update.ejs'), { user: results });
	});
});

// check changes and update manager profile
app.post('/manager-profile-update', authenticateAdmin, function (request, response) {
	var username = request.session.username;
	var password = request.body.password;
	var email = request.body.email;

	// update database email
	if (email) {
		connection.query('UPDATE users SET email = ? WHERE username = ?;', [email, username], function (error, results, fields, ) {
			if (error) {
				response.render(path.join(__dirname + '/views/manager-profile.ejs'), { confirm: "An error has occurred. Your email has not been changed." });
				return connection.rollback(function() {
					throw error;
				});
			}
		});
	}
	// update database hashed password
	if (password.length > 0)
	{ 
		bcrypt.hash(password, saltRounds, function(error, hash) { 
			connection.query('UPDATE users SET password = ? WHERE username = ?;', [hash, username], function(error, results, fields) {
				if (error) {
					response.render(path.join(__dirname + '/views/manager-profile.ejs'), { confirm: "An error has occurred. Your password has not been changed." });
					return connection.rollback(function() {
						throw error;
					});
				}
				response.redirect('/manager-profile');
			});
		});
	}
	else {response.redirect('/manager-profile');}
}); 

// render emailing page with current groups and projects
app.get('/manager-email', authenticateAdmin, function(request, response) {
	var emailSent = request.query.sent;
	var message = "\xa0";
	if (emailSent) {
		message = emailSent;
	}
	async.parallel({
		groups: function(callback) {
			connection.query('SELECT * FROM traininggroup;', callback);
		},
		projects: function(callback) {
			connection.query('SELECT * from project;', callback);
		}
	},
	function(error, results) {
		try { 
			if (error) { 
				throw error;
			} else {
				response.render(path.join(__dirname + '/views/manager-email'), {training: results.groups[0], project: results.projects[0], message: message});
			}
		} catch (error) { 
			response.status(400).send("ERROR: Unable to load create user page.");
		}
	});
});

app.post('/manager-email', authenticateAdmin, function(request, response) {
	
	// get request body
    var email_data = request.body;

    // create an array of recipients
    // string from recipients field
    var rec_str= email_data.recipients.replace(/\s+/g, '');
	// string from cc field
    var cc_str = email_data.cc.replace(/\s+/g, '');
    //array of recipients
    var rec_arr = [];
    rec_arr.push(rec_str.split(",")); 
    var cc_arr = []
    cc_arr.push(cc_str.split(","));

    // group recipients
	// group is an array of all the different groups
	var groups = email_data.group;
	var projects = email_data.project; 
    //get emails of people in group
	var group_arr = [];
	var project_arr = []; 
	// compile email addresses of users in selected groups 
	connection.query('SELECT email FROM users WHERE username = ANY (SELECT username FROM ingroup WHERE groupName IN (?))', [groups], function (err, result, fields) {
		if (err) {
			throw err;
		} else {
			for (var j = 0; j < result.length; j++) {
				group_arr.push(result[j].email);
			}
			// compile email addresses of users in selected projects
			connection.query('SELECT email FROM users WHERE username = ANY (SELECT username FROM worksOn WHERE projectName IN (?));', [projects], function(err, result, fields) {
				if (err) { 
					throw err; 
				} else { 
					for (var k = 0; k < result.length; k++) { 
					project_arr.push(result[k].email);
					}
					// subject of email
					var subject = email_data.subject;
					// message of email 
					var message = email_data.message;

					// UPDATES REQUIRED - user and pass 
					// email credentials 
					var transporter = nodemailer.createTransport({
						service: 'gmail',
						auth: {
						user: 'email_address',		// email address
						pass: 'email_password'		// password
						}
					});

					// combine recipients and remove duplicates
					rec_arr.push(group_arr, project_arr);
					combined_array = rec_arr;
					combined_string = combined_array.join(" , ");

					var mailOptions = {
						from: 'email_address',
						to: combined_string,
						cc: cc_arr.join(", "),
						subject: subject,
						text: message
					};
										
					// send email 
					transporter.sendMail(mailOptions, function(error, info){
						if (error) {
							throw error;
						} 
					});
				}
				var string = encodeURIComponent('Email successfuly sent');
  				response.redirect('/manager-email?sent=' + string);
			});
		}
	});
});

// render page to display all current users in system 
app.get('/manager-users', authenticateAdmin, function(request, response) { 
	// obtain user related info.
	async.parallel({ 
		users: function(callback) {
			connection.query('SELECT users.username, firstName, lastName, email FROM users;', callback);
		},
		training: function(callback) {
			connection.query('SELECT * FROM inGroup;', callback);
		}, 
		projects: function(callback) {
			connection.query('SELECT * FROM worksOn;', callback);
		},
		supervisors: function(callback) {
			connection.query('SELECT * FROM supervisor;', callback);
		}, 
		fundingAccounts: function(callback) { 
			connection.query('SELECT * from has;', callback);
		}
	},
	function(error, results) {
		if (error) { 
			response.status(400).send(error); 
		} else {
			response.render(path.join(__dirname + '/views/manager-users'), {users: results.users[0], training: results.training[0],
				projects: results.projects[0], supervisors: results.supervisors[0], fundingAccounts: results.fundingAccounts[0]});
		}
	});
}); 

// render page to create new user 
app.get('/create-user', authenticateAdmin, function(request, response) { 
	async.parallel({
		groups: function(callback) {
			connection.query('SELECT * FROM traininggroup;', callback);
		},
		projects: function(callback) {
			connection.query('SELECT * from project;', callback);
		}
	},
	function(error, results) {
		try { 
			if (error) { 
				throw error;
			} else {
				response.render(path.join(__dirname + '/views/create-user'), {training: results.groups[0], project: results.projects[0]});
			}
		} catch (error) { 
			response.status(400).send("ERROR: Unable to load create user page.");
		}
	});
}); 

// submit create user form
app.post('/create-user', authenticateAdmin, function(request, response) {
	
	// get input and input check 
	var username = (request.body.username).replace(/\s/g, '');
	var firstName = request.body.firstname;
	var lastName = request.body.lastname;
	var email = (request.body.email).replace(/\s/g, '');
	var password = (request.body.password).replace(/\s/g, ''); 
	var projects = request.body.projects;
	var training = request.body.training; 

	if (username.length > 50) { 
		throw "ERROR: Username exceeds permitted length of 50 characters.";
	} 
	if (firstName.length > 50) { 
		throw "ERROR: Firstname exceeds permitted length of 50 characters.";
	}
	if (lastName.length > 50) { 
		throw "ERROR: Lastname exceeds permitted length of 50 characters.";
	}
	if (email.length > 50) { 
		throw "ERROR: Email exceeds permitted length of 50 characters.";
	}
	if (password.length > 50) { 
		throw "ERROR: Password exceeds permitted length of 50 characters.";
	}
	
	// waterfall execution in series
	async.waterfall([
		// check if user already exists in database 
		function checkExistingUsers(callback) { 
			connection.query('SELECT * FROM users WHERE username = ? AND firstName = ? AND lastName = ?;', [username, firstName, lastName], function(error, results, fields) {
				try { 
					if (results.length > 0) {
						throw "ERROR: User already exists."; 
					} else {
						callback(null, true);
					}
				} catch (error) { 
					response.status(400).send(error);
				}
			});
		},

		// add new user to database 
		function createNewUser(userExists, callback) {
			// add new user if they do not already exist 
			if (userExists) {
				bcrypt.hash(password, saltRounds, function(error, hash) {
					connection.query('INSERT INTO users VALUES (?, ?, ?, ?, ?, 0);', [username, hash, firstName, lastName, email], function(error, results, fields) {
						callback(null, true); 
					});
				});
				
			} else { 
				callback(null, false); 
			}
		},

		// add associated training groups to new user 
		function addTraining(status, callback) {

			if (status) {
				if (typeof training == 'string') { 
					training = [training];
				}

				async.forEachOf(training, function(value, key, callback) {
					connection.query('INSERT INTO inGroup VALUES (?, ?);', [username, training[key]], function(error, results, fields) {
					});
				});
				callback(null, true);
			} else {
				callback(null, false);
			}
		},

		// add associated projects to new user 
		function addProject(status, callback) {
			if (status) {
				if (typeof projects == 'string') { 
					projects = [projects];
				}
				async.forEachOf(projects, function(value, key, callback) {
					connection.query('INSERT INTO worksOn VALUES (?, ?);', [username, projects[key]], function(error, results, fields) {
					});
				});
				callback(null, true);
			} else {
				callback(null, false);
			}
		}
	],

	// display confirmation message and redirect 
	function(error, result) {
		try { 
			if (error) { 
				throw error; 
			} else { 
				response.redirect('/manager-users');
			}
		} catch (error) { 
			response.status(400).send(error);
		}
	});
});

// render page to edit user with selected user's information
app.get('/edit-user', authenticateAdmin, function(request,response) { 
	var selected = request.session.selected; 
	// get selected user info
	async.parallel({
		userInfo: function(callback) {
			connection.query('SELECT * FROM users WHERE username = ?;', [selected], callback);
		}, 
		userTraining: function(callback) {
			connection.query('SELECT * FROM inGroup WHERE username = ?;', [selected], callback);
		}, 
		userProjects: function(callback) {
			connection.query('SELECT * FROM worksOn WHERE username = ?;', [selected], callback);
		}, 
		training: function(callback) {
			connection.query('SELECT * FROM traininggroup;', callback);
		},
		projects: function(callback) {
			connection.query('SELECT * from project;', callback);
		}
	}, 
	function(error, results) {
		try {
			if (error) { 
				throw error; 
			} else { 
				response.render(path.join(__dirname + '/views/edit-user'), {user: results.userInfo[0], userTraining: results.userTraining[0],
				userProjects: results.userProjects[0], training: results.training[0], projects: results.projects[0]});
			}
		} catch (error) { 
			response.status(400).send(error);
		}
 	});
});

// submit updated user information
app.post('/edit-user', authenticateAdmin, function(request, response) { 
	// get information and input check
	var firstName = request.body.firstname;
	var lastName = request.body.lastname;
	var email = (request.body.email).replace(/\s/g, '');
	var password = (request.body.password).replace(/\s/g, ''); 
	var training = request.body.training; 
	var projects = request.body.projects; 
	var selected = request.session.selected;

	if (firstName.length > 50) { 
		throw "ERROR: Firstname exceeds permitted length of 50 characters.";
	}
	if (lastName.length > 50) { 
		throw "ERROR: Lastname exceeds permitted length of 50 characters.";
	}
	if (email.length > 50) { 
		throw "ERROR: Email exceeds permitted length of 50 characters.";
	}
	if (password.length > 50) { 
		throw "ERROR: Password exceeds permitted length of 50 characters.";
	}
	if (typeof training == 'string') { 
		training = [training]; 
	} 
	if (typeof projects == 'string') {
		projects = [projects];
	}

	connection.beginTransaction(function (error) { 
		try {
			if (error) { 
				throw error; 
			} else { 
				// update user account info
				connection.query('UPDATE users SET firstName = ?, lastName = ?, email = ? WHERE username = ?;', [firstName, lastName, email, selected], function(error, results, fields) {
					if (error) { 
						return connection.rollback(function() {
							throw error; 
						});
					}

					// update password hash only if a new password is entered
					if (password.length > 0) { 
						bcrypt.hash(password, saltRounds, function(error, hash) { 
							connection.query('UPDATE users SET password = ? WHERE username = ?;', [hash, selected], function(error, results, fields) {
								if (error) { 
									return connection.rollback(function() {
										throw error; 
									});
								}
							});
						});
					}
					
					// delete user's groups 
					connection.query('DELETE FROM inGroup WHERE username = ?;', [selected], function(error, results, fields) {
						if (error) { 
							return connection.rollback(function() {
								throw error; 
							});
						}

						async.forEachOf(training, function(value, key, callback) {
							// add updated groups 
							connection.query('INSERT INTO inGroup VALUES (?, ?);', [selected, training[key]], function(error, results, fields) {
								if (error) { 
									return connection.rollback(function() {
										throw error; 
									});
								}
							})
						});

						// delete user's projects 
						connection.query('DELETE from worksOn WHERE username = ?', [selected], function(error, results, fields) {
							if (error) { 
								return connection.rollback(function() {
									throw error; 
								});
							}
						
							// add updated projects 
							async.forEachOf(projects, function(value, key, callback) {
								connection.query('INSERT INTO worksOn VALUES (?, ?);', [selected, projects[key]], function(error, results, fields) {
									if (error) { 
										return connection.rollback(function() {
											throw error; 
										});
									}
								});
							});
						});
						// commit transaction if prev. steps successful
						connection.commit(function(error) {
							if (error) {
								return connection.rollback(function() {
									throw error; 
								});
							}
						});
					});
				});
				response.redirect('/manager-users');
			} 
		} catch (error) { 
			response.status(400).send(error);
		}	
	});
});

// route user action to appropriate function: edit/delete user, create supervisor 
app.post('/modify-user', authenticateAdmin, function(request, response) {
	var action = request.body.action;
	var selected = request.body.select;
	
	if (typeof selected == 'string') { 
		selected = [selected];
	} 
	if (typeof selected == 'undefined') { 
		response.redirect('/manager-users');
	} else {
		if (action == "delete") {
			try {
				if (selected.includes("admin")) { 
					throw "ERROR: Admin cannot be deleted.";
				} else {
					async.forEachOf(selected, function(value, key, callback) {
						connection.query('DELETE FROM users WHERE username = ?;', [selected[key]], callback);
					});
					response.redirect('/manager-users');
				}
			}
			catch (error) {
				throw error; 
			}
		} 
		
		if (action == "edit") {
			try {
				if (selected.length > 1) { 
					throw "ERROR: Only one user can be edited at a time.";
				} else { 
					request.session.selected = selected; 
					response.redirect('/edit-user');
				}
			} catch (error) { 
				response.status(400).send(error);
			}
		}

		if (action == "create-supervisor") { 
			try { 
				if (selected.length > 1) { 
					throw "ERROR: Only one supervisor can be created at a time.";
				} else { 
					request.session.selected = selected;
					response.redirect('/create-supervisor');
				}
			} catch (error) { 
				response.status(400).send(error);
			}
		}
	}
});

// render page to create supervisor 
app.get('/create-supervisor', authenticateAdmin, function(request, response) { 
	var selected = request.session.selected; 
	connection.query('SELECT * from users WHERE username = ?;', [selected], function(error, results, fields) {
		try { 
			if (error) { 
				throw error; 
			} else { 
				response.render(path.join(__dirname + '/views/create-supervisor.ejs'), {results});
			}
		} catch (error) { 
			response.status(400).send(error);
		}
	});
});

// submit new supervisor info. 
app.post('/create-supervisor', authenticateAdmin, function(request, response) {
	var username = request.body.username; 
	var fundingAccounts = request.body.fundingAccounts; 

	// split funding account string by commas, store as array 
	fundingAccounts = fundingAccounts.replace(/(\r\n|\n|\r)/g, '');	
	var fundingAccArray = fundingAccounts.split(',');
	for (var i = 0; i < fundingAccArray.length; i++) {
		fundingAccArray[i] = fundingAccArray[i].trim();
		if (fundingAccArray[i].length > 50) { 
			throw "ERROR: Funding account exceeds permitted length of 50 characters per account.";
		}
	}

	connection.query('INSERT INTO supervisor VALUES (?);', [username], function(error, results, fields) {
	});

	async.forEachOf(fundingAccArray, function(values, key, callback) {
		try {
			if (fundingAccArray[key] != '') {
				connection.query('INSERT INTO fundingAccount VALUES (?) ON DUPLICATE KEY UPDATE accountNumber = ?;', [fundingAccArray[key], fundingAccArray[key]], function(error, results, fields) {
					if (error) { 

						throw error;
					}
				});
				connection.query('INSERT INTO has VALUES (?,?);', [username, fundingAccArray[key]], function(error, results, fields) {
					if (error) { 
						throw error;
					}
				});
			} 
		} catch (error) {
			response.status(400).send(error);
		}
	},
	function(error) { 
		if (error) { 
			response.status(400).send(error);
		}  
	});
	response.redirect('/manager-users');
});

// route user action to appropriate function
app.post('/modify-supervisor', authenticateAdmin, function(request, response) {
	var action = request.body.action;
	var selected = request.body.select;
	
	if (typeof selected == 'string') { 
		selected = [selected];
	} 

	if (typeof selected == 'undefined') { 
		response.redirect('/manager-users');
	} else {
		if (action == "edit-supervisor") {
			if (selected.length > 1) { 
				response.status(400).send("ERROR: Only one supervisor can be edited at a time.");
			} else {
				request.session.selected = selected; 
				response.redirect('/edit-supervisor');
			}
		} 
		if (action == "delete-supervisor") {
			try {
				if (selected.includes("admin")) { 
					throw "ERROR: Admin cannot be deleted.";
				} else { 
					async.forEachOf(selected, function(value, key, callback) {
						connection.query('DELETE FROM supervisor WHERE username = ?', [selected[key]], function(error, results, fields) {
							if (error) { 
								throw error;
							} 
						});
					});
					response.redirect('/manager-users');
				}
			} catch (error) { 
				response.status(400).send(error);
			}
		}
	}
});

// render page to edit selected supervisor's info
app.get('/edit-supervisor', authenticateAdmin, function(request, response) { 
	var selected = request.session.selected;
	// get current info. 
	async.parallel({
		userInfo: function(callback) { 
			connection.query('SELECT username, firstname, lastname FROM users WHERE username = ?;', [selected], callback);
		}, 
		fundingInfo: function(callback) { 
			connection.query('SELECT accountNumber FROM has WHERE username = ?;', [selected], callback);
		}
	}, 
	function(error, results) { 
		if (error) { 
			response.status(400).send(error);
		} else { 
			// prepare funding codes to be displayed 
			var funding = '';
			for (var i = 0; i < results.fundingInfo[0].length; i++) { 
				if (i == results.fundingInfo[0].length - 1) { 
					funding += results.fundingInfo[0][i].accountNumber;
				} else { 
					funding += results.fundingInfo[0][i].accountNumber + ', ';
				}
			}
			response.render(path.join(__dirname + '/views/edit-supervisor.ejs'), {user: results.userInfo[0], funding});
		}

	});
}); 

// submit updated supervisor info. 
app.post('/edit-supervisor', authenticateAdmin, function(request, response) { 
	var username = request.body.username; 
	var fundingAccounts = request.body.fundingAccounts; 

	// parse into individual account numbers 
	fundingAccounts = fundingAccounts.replace(/(\r\n|\n|\r)/g, '');	
	var fundingAccArray = fundingAccounts.split(',');
	for (var i = 0; i < fundingAccArray.length; i++) {
		fundingAccArray[i] = fundingAccArray[i].trim();
		if (fundingAccArray[i].length > 50) { 
			throw "ERROR: Funding account exceeds permitted length of 50 characters per account.";
		}
	}
	
	// check that funding accounts are no longer active before updating
	async.waterfall([
		// get all funding accounts for user
		function getOldFunding(callback) { 
			connection.query('SELECT * FROM has WHERE username = ?;', [username], function(error, results, fields) {
				if (results.length > 0) { 
					callback(null, results);
				}
			});
		}, 
		// get all active projects 
		function getActiveProjects(results, callback) { 
			var oldFundingAcc = []; 
			for (var i = 0; i < results.length; i++) { 
				oldFundingAcc.push(results[i].accountNumber);
			}
			if (typeof oldFundingAcc == 'string') { 
				oldFundingAcc = [oldFundingAcc];
			}
			connection.query('SELECT * FROM funds;', function(error, results, fields) {
				if (results.length > 0) {
					callback(null, oldFundingAcc, results);
				}
			});
		}, 
		// determine whether funding accounts to be deleted are still linked to active projects
		function checkActiveProjects(oldFundingAcc, results, callback) {
	
			var activeProjects = []; 
			for (var j = 0; j < results.length; j++) { 
				activeProjects.push(results[j].accountNumber);
			}

			for (var k = 0; k < oldFundingAcc.length; k++) {
				// delete funding account if no longer active
				if (!(activeProjects.includes(oldFundingAcc[k])) && (!(fundingAccounts.includes(oldFundingAcc[k])))) { 
					connection.query('DELETE FROM fundingAccount WHERE accountNumber = ?', [oldFundingAcc[k]], function(error, results, fields) {
						if (error) { 
							response.status(400).send(error);
						}
					});
				} 
			}
			callback(null, oldFundingAcc);
		}, 
		function updateFundingAccounts(oldFundingAcc, callback) {
			async.forEachOf(fundingAccArray, function(values, key, callback) {
				try {
					if (fundingAccArray[key] != '' && (!(oldFundingAcc.includes(fundingAccArray[key])))) {
						connection.query('INSERT INTO fundingAccount VALUES (?) ON DUPLICATE KEY UPDATE accountNumber = ?;', [fundingAccArray[key], fundingAccArray[key]], function(error, results, fields) {
							if (error) { 
								throw error;
							}
						});
						connection.query('INSERT INTO has VALUES (?,?) ON DUPLICATE KEY UPDATE username = ?, accountNumber = ?;', [username, fundingAccArray[key], username, fundingAccArray[key]], function(error, results, fields) {
							if (error) { 
								throw error;
							}
						});
					} 
				} catch (error) {
					response.status(400).send(error);
				}
			},
			function(error) { 
				if (error) { 
					response.status(400).send(error);
				} 	
			});
		}
	], 
	function(error, results) { 
		if (error) { 
			response.status(400).send(error);
		}
	});
	response.redirect('/manager-users');
});

// render page to display all current groups 
app.get('/manager-groups', authenticateAdmin, function(request, response) { 
	async.parallel({
		group: function(callback) { 
			connection.query('SELECT * FROM trainingGroup;', callback);
		}, 
		training: function(callback) { 
			connection.query('SELECT * FROM trainedFor', callback);
		}
	}, 
	function(error, results) { 
		if (error) { 
			throw "ERROR: Unable to get group information.";
		} else { 
			response.render(path.join(__dirname + '/views/manager-groups.ejs'), {group: results.group[0], training: results.training[0]});
		}
	});
}); 

// render page to create group
app.get('/create-group', authenticateAdmin, function(request, response) { 
	connection.query('SELECT * FROM equipment;', function(error, results, fields) {
		try { 
			if (error) { 
				throw "ERROR: Unable to get equipment list."; 
			} else { 
				response.render(path.join(__dirname + '/views/create-group.ejs'), {training: results});
			}
		} catch (error) { 
			response.status(400).send(error);
		}
	});
});

// submit form to create new group
app.post('/create-group', authenticateAdmin, function(request, response) {
	var groupName = request.body.groupName; 
	var equipment = request.body.training; 

	if (typeof equipment == 'string') { 
		equipment = [equipment];
	}
	if (groupName.length > 50) { 
		throw "ERROR: Group name exceeds permitted length of 50 characters.";
	}
	// check group does not already exist 
	connection.query('SELECT * FROM trainingGroup WHERE groupName = ?', [groupName], function(error, results, fields) {
		try {
			if (results.length > 0) { 
				throw "ERROR: Group already exists.";
			} else { 
				connection.beginTransaction(function(error) {
					try {
						if (error) { 
							throw "ERROR: Unable to start MySQL transaction.";
						} else { 
							// insert new group
							connection.query('INSERT INTO trainingGroup VALUES (?);', [groupName], function(error, results, fields) {
								if (error) { 
									return connection.rollback(function() {
										throw "ERROR: Unable to insert new group. MySQL rollback performed."; 
									});
								} else { 
									// insert new training
									async.forEachOf(equipment, function(value, key, callback) {
										connection.query('INSERT INTO trainedFor VALUES (?,?);', [groupName, equipment[key]], function(error, results, fields) {
											if (error) { 
												return connection.rollback(function() {
													throw "ERROR: Unable to insert approved equipment. MySQL rollback performed."; 
												});
											} 
										});
									});
									// commit if prev. steps successful 
									connection.commit(function(error) {
										if (error) {
											return connection.rollback(function() {
												throw "ERROR: Unable to commit transaction. MySQL rollback performed."; 
											});
										}
									});
									response.redirect('/manager-groups');
								}
							});
						}
					} catch (error) { 
						response.status(400).send(error);
					}
				});
			}
		} catch (error) { 
			response.status(400).send(error);
		}
	});
});

// route user action to appropriate function 
app.post('/modify-group', authenticateAdmin, function(request, response) {

	var action = request.body.action; 
	var selected = request.body.select; 

	if (typeof selected == 'string') { 
		selected = [selected];
	}
	if (typeof selected == 'undefined') { 
		response.redirect('/manager-groups');
	} else {
		
		if (action == 'edit-group') { 
			if (selected.length > 1) { 
				throw "ERROR: Unable to edit more than one group at a time.";
			} else { 
				request.session.selected = selected; 
				response.redirect('/edit-group');
			}
		}

		if (action == 'delete-group') { 
			async.forEachOf(selected, function(value, key, callback) {
				connection.query('DELETE FROM trainingGroup WHERE groupName = ?;', [selected[key]], function(error, results, fields) {
					if (error) { 
						throw error; 
					} 
				});
			});
			response.redirect('/manager-groups');
		}
	}
});

// render page to edit group 
app.get('/edit-group', authenticateAdmin, function(request, response) { 
	var selected = request.session.selected; 
	
	// fetch group information
	async.parallel({
		groupName: function(callback) { 
			connection.query('SELECT * FROM trainingGroup WHERE groupName = ?', [selected], callback);
		},
		currentTraining: function(callback) { 
			connection.query('SELECT * FROM trainedFor WHERE groupName = ?;', [selected], callback);
		}, 
		equipment: function(callback) { 
			connection.query('SELECT * FROM equipment;', callback);
		}
	}, 
	function(error, results) {
		if (error) { 
			response.status(400).send(error);
		} else { 
			response.render(path.join(__dirname + '/views/edit-group.ejs'), {group: results.groupName[0], current: results.currentTraining[0], all: results.equipment[0]});
		}
	});
});

// submit updated group info.
app.post('/edit-group', authenticateAdmin, function(request, response) { 
	var groupName = request.body.groupName; 
	var training = request.body.training; 

	if (typeof training == 'string') { 
		training = [training];
	}

	connection.beginTransaction(function(error) {
		try {
			if (error) { 
				throw "ERROR: Unable to start MySQL transaction.";
			} else { 
				// remove old training
				connection.query('DELETE FROM trainedFor WHERE groupName = ?;', [groupName], function(error, results, fields) {
					if (error) { 
						return connection.rollback(function() {
							throw error; 
						});
					} else { 
						// insert updated training
						async.forEachOf(training, function(value, key, callback) {
							connection.query('INSERT INTO trainedFor VALUES (?,?);', [groupName, training[key]], function(error, results, fields) {
								if (error) { 
									return connection.rollback(function() {
										throw error; 
									});
								} 
							});
						});
						// commit transaction if all previous steps successful 
						connection.commit(function(error) {
							if (error) {
								return connection.rollback(function() {
									throw "ERROR: Unable to commit transaction. MySQL rollback performed."; 
								});
							}
						});
						response.redirect('/manager-groups');
					}
				});
			}
		} catch (error) { 
			response.status(400).send(error);
		}		
	});
});

// render page to display all current equipment 
app.get('/manager-equipment', authenticateAdmin, function(request, response) { 
	// get equipment data from database to display 
	async.parallel({
		equipment: function(callback) {
			connection.query('SELECT * FROM equipment ORDER BY equipmentName;', callback);
		}, 
		usageModes: function(callback) { 
			connection.query('SELECT * from usageMode;', callback);
		},
		primetime: function(callback) {
			connection.query('SELECT * FROM primetime ORDER BY equipmentName;', callback);
		}
	}, 
	function(error, results) {
		if (error) { 
			throw "ERROR: Unable to GET equipment data.";
		} else { 
			// convert values from 0/1 to T/F for displaying on webpage
			for (var i = 0; i < results.equipment[0].length; i++) { 
				results.equipment[0][i].enableSensitive = integerToBoolean(results.equipment[0][i].enableSensitive);
				results.equipment[0][i].allowConsecutive = integerToBoolean(results.equipment[0][i].allowConsecutive);
				results.equipment[0][i].enablePrimetime = integerToBoolean(results.equipment[0][i].enablePrimetime);
			}
			for (var j = 0; j < results.primetime[0].length; j++) { 
				results.primetime[0][j].enforceSat = integerToBoolean(results.primetime[0][j].enforceSat);
				results.primetime[0][j].enforceSun = integerToBoolean(results.primetime[0][j].enforceSun);
				results.primetime[0][j].allowConsecutive = integerToBoolean(results.primetime[0][j].allowConsecutive);
			}
			response.render(path.join(__dirname + '/views/manager-equipment.ejs'), {equipment: results.equipment[0], usageMode: results.usageModes[0], primetime: results.primetime[0]});
		}
	});
}); 

// render page to create equipment 
app.get('/create-equipment', authenticateAdmin, function(request, response) { 
	response.render(path.join(__dirname + '/views/create-equipment.ejs'));
}); 

// submit form to create new equipment 
app.post('/create-equipment', authenticateAdmin, function(request, response) {
	// equipment info
	var equipmentName = request.body.equipmentName; 
	var location = request.body.location; 
	var usageModes = request.body.usageModes; 
	var sensitivity = request.body.sensitivity; 
	var consecutive = request.body.consecutive; 
	var maxBookings = request.body.maxBookings; 
	var maxTime = request.body.maxTime; 
	var primetime = request.body.primetime; 

	if (equipmentName.length > 50) { 
		throw "ERROR: Equipment name exceeds permited length of 50 characters.";
	}
	if (location.length > 50) { 
		throw "ERROR: Location exceeds permited length of 50 characters.";
	}

	// process and store usage mode values in array 
	usageModes = usageModes.replace(/(\r\n|\n|\r)/g, '');	
	var usageModesArray = usageModes.split(',');
	for (var i = 0; i < usageModesArray.length; i++) {
		usageModesArray[i] = usageModesArray[i].trim();
		if (usageModesArray[i].length > 50) { 
			throw "ERROR: Usage mode exceeds permitted length of 50 characters per mode.";
		}
	}

	// convert values from T/F to 0/1 for storage in database 
	sensitivity = booleanToInteger(sensitivity);
	consecutive = booleanToInteger(consecutive); 
	primetime = booleanToInteger(primetime);
	
	async.waterfall([
		// check if equipment already exists before adding new entry 
		function checkExistingEquipment(callback) {
			connection.query('SELECT * from equipment WHERE equipmentName = ?', [equipmentName], function(error, results, fields) {
				try { 
					if (results.length > 0) { 
						throw "ERROR: Equipment already exists.";
					} else {
						callback(null, true);
					}
				} catch (error) { 
					response.status(400).send(error);
				}
			});
		},
		// add new equipment if it does not exist
		function createEquipment(status, callback) {
			if (status) {
				connection.beginTransaction(function(error) {
					if (error) { 
						throw "ERROR: MySQL transaction error while creating equipment."; 
					}
					// insert new equipment 
					connection.query('INSERT INTO equipment VALUES (?, ?, ?, ?, ?, ?, ?);', [equipmentName, location, sensitivity, consecutive, maxBookings, maxTime, primetime], function(error, results, fields) {
						if (error) { 
							return connection.rollback(function() {
								throw "ERROR: Unable to insert equipment. MySQL rollback performed."; 
							});
						}
						// insert usage modes
						async.forEachOf(usageModesArray, function(value, key, callback) {
							if (usageModesArray[key] != '' && usageModesArray[key] != ' ') {
								connection.query('INSERT INTO usageMode VALUES (?, ?) ON DUPLICATE KEY UPDATE equipmentName = ?, modes = ?;', [equipmentName, usageModesArray[key], equipmentName, usageModesArray[key]], function(error, results, fields) {
									if (error) { 
										return connection.rollback(function() {
											throw "ERROR: Unable to insert usage mode. MySQL rollback performed. "; 
										});
									}
								});
							}
						});
						// commit transaction if all previous steps successful 
						connection.commit(function(error) {
							if (error) {
								return connection.rollback(function() {
									throw "ERROR: Unable to commit transaction. MySQL rollback performed."; 
								});
							}
						});
					}); 
				});
				callback(null, true);
			} else { 
				callback(null, false); 
			}
		},
		function(error, results) { 
			response.redirect('/manager-equipment'); 
		}
	]);
});

// render page to create equipment primetime restrictions
app.get('/create-primetime', authenticateAdmin, function(request, response) {
	var selected = request.session.selected; 
	connection.query('SELECT * FROM primetime WHERE equipmentName = ?;', [selected], function(error, results, fields) { 
		try {
			if (results.length > 0) { 
				throw "ERROR: Primetime already exists for this equipment.";
			} else {
				response.render(path.join(__dirname + '/views/create-primetime.ejs'), {equipment: selected});
			}
		} catch (error) { 
			response.status(400).send(error);
		} 
	});
});

// submit new equipment primetime restrictions
app.post('/create-primetime', authenticateAdmin, function(request, response) {
	// primetime info
	var equipmentName = request.body.equipmentName; 
	var primetimeStart = request.body.primetimeStart; 
	var primetimeEnd = request.body.primetimeEnd; 
	var allowConsecutive = request.body.allowConsecutive;
	var maxTime = request.body.maxBookingTime; 
	var enforceSat = request.body.enforceSat; 
	var enforceSun = request.body.enforceSun;

	// convert T/F values to 0/1 to store in database 
	allowConsecutive = booleanToInteger(allowConsecutive);
	enforceSat = booleanToInteger(enforceSat);
	enforceSun = booleanToInteger(enforceSun);
	
	connection.query('INSERT INTO primetime VALUES (?, ?, ?, ?, ?, ?, ?);', [equipmentName, primetimeStart, primetimeEnd, enforceSat, enforceSun, allowConsecutive, maxTime], function(error, results, fields) {
		try {
			if (error) { 
				throw "ERROR: Unable to insert primetime restrictions.";
			} else {
				response.redirect('/manager-equipment');
			}
		} catch (error) { 
			response.status(400).send(error);
		}  
	});
}); 

// process and route edit/delete primetime functions
app.post('/modify-primetime', authenticateAdmin, function(request, response) { 
	var action = request.body.action;
	var selected = request.body.select;

	if (typeof selected == 'string') { 
		selected = [selected];
	}

	// continue only if selection is made
	if (typeof selected != 'undefined') {
		if (action == "delete") {
			// iterate and delete selected primetimes  
			async.forEachOf(selected, function(value, key, callback) {
				connection.query('DELETE FROM primetime WHERE equipmentName = ?;', [selected[key]], function(error, results, fields) {
					try { 
						if (error) { 
							throw "ERROR: Unable to delete primetime.";
						} 
					} catch (error) { 
						response.status(400).send(error);
					}
				});
			});
			response.redirect('/manager-equipment');
		} 
		
		// redirect to edit primetime page for selected equipment 
		if (action == "edit") {
			if (selected.length > 1) { 
				response.status(400).send("ERROR: Only one equipment item can be edited at a time.");
			} else { 
				request.session.selected = selected;  
				response.redirect('/edit-primetime');
			}
		} 
	} else { 
		response.redirect('/manager-equipment');
	}
}); 

// render page to edit selected primetime
app.get('/edit-primetime', authenticateAdmin, function(request, response) { 
	var selected = request.session.selected; 

	if (selected.length > 1) { 
		response.status(400).send("ERROR: Cannot edit more than one primetime.");
	} 
	
	connection.query('SELECT * FROM primetime WHERE equipmentName = ?;', [selected], function(error, results, fields) { 
		try {
			if (error) { 
				throw error;
			} else { 
				response.render(path.join(__dirname + '/views/edit-primetime.ejs'), {equipment: results});
			}
		} catch (error) { 
			response.status(400).send(error);
		}
	});
});

// store updated primetime restrictions in database 
app.post('/edit-primetime', authenticateAdmin, function(request, response) { 
	// primetime info. 
	var equipmentName = request.body.equipmentName; 
	var primetimeStart = request.body.primetimeStart;
	var primetimeEnd = request.body.primetimeEnd; 
	var allowConsecutive = request.body.allowConsecutive; 
	var maxBookingTime = request.body.maxBookingTime; 
	var enforceSat = request.body.enforceSat; 
	var enforceSun = request.body.enforceSun; 

	// convert T/F to 0/1 
	allowConsecutive = booleanToInteger(allowConsecutive);
	enforceSat = booleanToInteger(enforceSat); 
	enforceSun = booleanToInteger(enforceSun);

	// update primetime in database 
	connection.query('UPDATE primetime SET equipmentName = ?, startTime = ?, endTime = ?, enforceSat = ?, enforceSun = ?, allowConsecutive = ?, maxBookingTime = ?', 
	[equipmentName, primetimeStart, primetimeEnd, enforceSat, enforceSun, allowConsecutive, maxBookingTime], function(error, results, fields) { 
		try { 
			if (error) { 
				throw error;
			} else { 
				response.redirect('/manager-equipment');
			} 
		} catch (error) { 
			response.status(400).send(error);
		}
	});
});

// process and route to edit/delete equipment functions
app.post('/modify-equipment', authenticateAdmin, function(request,response) { 
	var action = request.body.action;
	var selected = request.body.select;

	if (typeof selected == 'string') { 
		selected = [selected];
	}

	// continue only if equipment is selected 
	if (typeof selected != 'undefined') {
		if (action == "delete") {
			// delete each equipment item selected
			async.forEachOf(selected, function(value, key, callback) {
				connection.query('DELETE FROM equipment WHERE equipmentName = ?;', [selected[key]], function(error, results, fields) {
					if (error) { 
						throw "ERROR: Unable to delete equipment.";
					}
				});
			});
			response.redirect('/manager-equipment');
		} 
		
		// redirect to edit equipment page with selected equipment 
		if (action == "edit") {
			if (selected.length > 1) { 
				throw "ERROR: Only one equipment item can be edited at a time.";
			} else { 
				request.session.selected = selected;  
				response.redirect('/edit-equipment');
			}
		} 

		// redirect to create primetime page with selected equipment 
		if (action == "create") { 
			if (selected.length > 1) { 
				throw "ERROR: Only one primetime can be created at a time.";
			} else {
				request.session.selected = selected; 
				response.redirect('/create-primetime');
			}
		}
	} else { 
		response.redirect('/manager-equipment');
	}
});

// render page to edit selected equipment 
app.get('/edit-equipment', authenticateAdmin, function(request,response) { 
	var selected = request.session.selected; 

	// fetch existing data for selected equipmentto display on edit page
	async.parallel({
		equipment: function(callback) { 
			connection.query('SELECT * from equipment WHERE equipmentName = ?;', [selected], callback);
		}, 
		usageModes: function(callback) { 
			connection.query('SELECT * from usageMode WHERE equipmentName = ?;', [selected], callback);
		}
	},
	function(error, results) { 
		if (error) { 
			throw "ERROR: Unable to fetch equipment data to edit.";
		}

		// separate usage modes by commas
		var options = '';
		for (var i = 0; i < results.usageModes[0].length; i++) { 
			if (i == results.usageModes[0].length - 1) { 
				options += results.usageModes[0][i].modes; 
			} else { 
				options += results.usageModes[0][i].modes + ', '; 
			}
		}
		options = [options];
		response.render(path.join(__dirname + '/views/edit-equipment.ejs'), {equipment: results.equipment[0], options});
	});
}); 

// submit updated equipment information
app.post('/edit-equipment', authenticateAdmin, function(request, response) {
	// equipment info.
	var selected = request.session.selected; 
	var location = request.body.location; 
	var usageModes = request.body.usageModes; 
	var sensitivity = request.body.sensitivity; 
	var consecutive = request.body.consecutive; 
	var maxBookings = request.body.maxBookings; 
	var maxTime = request.body.maxTime; 
	var primetime = request.body.primetime; 

	if (location.length > 50) { 
		throw "ERROR: Location exceeds permited length of 50 characters.";
	}

	// process and store usage mode values in array 
	usageModes = usageModes.replace(/(\r\n|\n|\r)/g, '');	
	var usageModesArray = usageModes.split(',');
	for (var i = 0; i < usageModesArray.length; i++) {
		usageModesArray[i] = usageModesArray[i].trim();
		if (usageModesArray[i].length > 50) { 
			throw "ERROR: Usage mode exceeds permitted length of 50 characters per mode.";
		}
	}

	// convert values from T/F to 0/1 for storage in database 
	sensitivity = booleanToInteger(sensitivity);
	consecutive = booleanToInteger(consecutive); 
	primetime = booleanToInteger(primetime);

	connection.beginTransaction(function(error) { 
		if (error) { 
			throw "ERROR: Unable to begin MySQL transaction."; 
		} 
		// update equipment data 
		connection.query('UPDATE equipment SET location = ?, enableSensitive = ?, allowConsecutive = ?, maxBookingsWeekly = ?, maxBookingTime = ?, enablePrimetime = ? WHERE equipmentName = ?', 
		[location, sensitivity, consecutive, maxBookings, maxTime, primetime, selected], function(error, results, fields) {
			if (error) {
				return connection.rollback(function() {
					throw "ERROR: Unable to update equipment. MySQL rollback performed.";
				});
			}	
			// remove old usage modes
			connection.query('DELETE FROM usageMode WHERE equipmentName = ?;', [selected], function(error, results, fields) {
				if (error) {
					return connection.rollback(function() {
						throw "ERROR: Unable to delete usage modes during update. MySQL rollback performed.";
					});
				}	
			});
				
			// insert new usage modes
			async.forEachOf(usageModesArray, function(value, key, callback) {
				if (usageModesArray[key] != '' && usageModesArray[key] != ' ') { 
					connection.query('INSERT INTO usageMode VALUES (?, ?);', [selected, usageModesArray[key]], function(error, results, fields) {
						if (error) {
							return connection.rollback(function() {
								throw "ERROR: Unable to insert new usage modes during update. MySQL rollback performed.";
							});
						}	
					});
				}
			});

			// commit transaction 
			connection.commit(function(error) {
				if (error) {
				  return connection.rollback(function() {
					throw "ERROR: Unable to update equipment. MySQL rollback performed.";
					});
				}
			});
		});
	});
	response.redirect('/manager-equipment'); 
});

// render page to display all current projects 
app.get('/manager-projects', authenticateAdmin, function(request, response) { 
	// fetch all project information to be displayed
	async.parallel({
		project: function(callback) {
			connection.query('SELECT * FROM project;', callback);
		},
		funds: function(callback) { 
			connection.query('SELECT * from funds;', callback);
		},
		has: function(callback) { 
			connection.query('SELECT * FROM has', callback);
		}, 
		users: function(callback) { 
			connection.query('SELECT * FROM users;', callback);
		}
	},
	function(error, results) { 
		try { 
			if (error) { 
				throw error;
			} else { 
				response.render(path.join(__dirname + '/views/manager-projects.ejs'), {project: results.project[0], funds: results.funds[0], has: results.has[0], users: results.users[0]});
			}
		} catch (error) { 
			response.status(400).send(error);
		}
	});
}); 

// render create project page
app.get('/create-project', authenticateAdmin, function(request, response) {
	connection.query('SELECT * FROM has;', function(error, results, fields) {
		try { 
			if (error) { 
				throw error;
			} else { 
				response.render(path.join(__dirname + '/views/create-project.ejs'), {funding: results});
			}
		} catch (error) { 
			response.status(400).send(error);
		}
	});
});

// submit new project 
app.post('/create-project', authenticateAdmin, function(request, response) {
	// project info. 
	var projectName = request.body.projectName; 
	var fundingAccounts = request.body.funding; 
	var description = request.body.description; 
	
	// typecast to prevent error 
	if (typeof fundingAccounts == 'string') {
		fundingAccounts = [fundingAccounts];
	}

	if (projectName.length > 50) { 
		throw "ERROR: Project name cannot exceed 50 characters.";
	}
	if (description.length > 100) { 
		throw "ERROR: Project description cannot exceed 100 characters.";
	}

	// check if project with same name exists
	connection.query('SELECT * FROM project WHERE projectName = ?;', [projectName], function(error, results, fields) {
		try {	
			if (results.length > 0) {
				throw "ERROR: Project already exists."; 
			} else { 
				connection.beginTransaction(function(error) {
					try { 
						if (error) { 
							throw error;
						} else { 
							// insert project 
							connection.query('INSERT INTO project VALUES (?,?);', [projectName, description], function(error, results, fields) {
								if (error) {
									return connection.rollback(function() {
										throw "ERROR: Unable to insert new project. MySQL rollback performed.";
									});
								} else { 
									// insert project funding
									async.forEachOf(fundingAccounts, function(value, key, callback) {
										connection.query('INSERT INTO funds VALUES (?,?);', [projectName, fundingAccounts[key]], function(error, results, fields) {
											if (error) {
												return connection.rollback(function() {
													throw "ERROR: Unable to insert funding information. MySQL rollback performed.";
												});
											}
										});
									});
								}
								connection.commit(function(error) {
									if (error) {
										return connection.rollback(function() {
											throw "ERROR: Unable to commit transaction. MySQL rollback performed.";
										});
									}
								});
							});
						}
					} catch (error) { 
						response.status(400).send(error);
					}
					response.redirect('/manager-projects');
				});
			}
		} catch (error) { 
			response.status(400).send(error);
		}
	});	
});

// route edit/delete requests to appropriate handlers 
app.post('/modify-project', authenticateAdmin, function(request, response) {
	var action = request.body.action; 
	var selected = request.body.select; 

	if (typeof selected == 'undefined') { 
		response.redirect('/manager-projects')
	} else {
		if (typeof selected == 'string') { 
			selected = [selected];
		}
		
		// redirect to edit project page
		if (action == "edit") { 
			if (selected.length > 1) { 
				throw "ERROR: Only one equipment item can be edited at a time.";
			} else { 
				request.session.selected = selected; 
				response.redirect('/edit-project');
			}
		}

		// delete selected projects
		if (action == "delete") { 
			connection.beginTransaction(function(error) { 
				try { 
					if (error) { 
						throw error;
					} else {  
						// iteratively delete selected projects
						async.forEachOf(selected, function(value, key, callback) {
							connection.query('DELETE FROM project WHERE projectName = ?;', [selected[key]], function(error, results, fields) {
								if (error) { 
									return connection.rollback(function() {
										throw "ERROR: Unable to delete project.";
									});
								}
							});
						});

						// commit changes if all successful
						connection.commit(function(error) {
							if (error) {
								return connection.rollback(function() {
									throw "ERROR: Unable to commit transaction. MySQL rollback performed.";
								});
							}
						});
						response.redirect('/manager-projects');
					}
				} catch (error) { 
					response.status(400).send(error);
				}
			});
		}
	}
});

// render page to edit project information
app.get('/edit-project', authenticateAdmin, function(request, response) {
	var selected = request.session.selected;

	async.parallel({
		project: function(callback) {
			connection.query('SELECT * FROM project WHERE projectName = ?;', [selected], callback);
		},
		funds: function(callback) { 
			connection.query('SELECT * from funds WHERE projectName = ?;', [selected], callback);
		},
		has: function(callback) { 
			connection.query('SELECT * FROM has', callback);
		} 
	}, 
	function(error, results) { 
		try { 
			if (error) { 
				throw error; 
			} else { 
				response.render(path.join(__dirname + '/views/edit-project.ejs'), {project: results.project[0], currentFunding: results.funds[0], availableFunding: results.has[0]});
			}
		} catch (error) { 
			response.status(400).send(error);
		}
	});
});

// submit updated project information
app.post('/edit-project', authenticateAdmin, function(request, response) { 
	// updated info.
	var projectName = request.body.projectName; 
	var funding = request.body.funding; 
	var description = request.body.description; 

	// typecast to prevent error 
	if (typeof funding == 'string') { 
		funding = [funding];
	}

	connection.beginTransaction(function(error) {
		if (error) { 
			throw error; 
		} else { 
			// update description
			connection.query('UPDATE project SET description = ? WHERE projectName = ?;', [description, projectName], function(error, results, fields) {
				if (error) {
					return connection.rollback(function() {
						throw "ERROR: Unable to update project. MySQL rollback performed.";
					});
				} else { 
					// remove old funding 
					connection.query('DELETE FROM funds WHERE projectName = ?;', [projectName], function(error, results, fields) {
						if (error) {
							return connection.rollback(function() {
								throw "ERROR: Unable to update project funding. MySQL rollback performed.";
							});
						} else { 
							// insert new funding
							async.forEachOf(funding, function(value, key, callback) {
								connection.query('INSERT INTO funds VALUES (?,?);', [projectName, funding[key]], function(error, results, fields) {
									if (error) {
										return connection.rollback(function() {
											throw "ERROR: Unable to update project funding. MySQL rollback performed.";
										});
									}
								});
							});
						}
					});
				}
				
				// commit changes if all previous steps successful
				connection.commit(function(error) {
					if (error) {
						return connection.rollback(function() {
							throw "ERROR: Unable to commit transaction. MySQL rollback performed.";
						});
					}
				});
				response.redirect('/manager-projects');
			});
		}
	});
});

// manager logs page
app.get('/manager-logs', authenticate, function(request,response) {
	var date = new Date();
	// get fields
	async.parallel({
		// get equipment list
		equipment: function (callback) {
			connection.query('SELECT * FROM equipment;', callback);
		},
		// get projects
		projects: function (callback) {
			connection.query('SELECT * FROM project;', callback);
		},
		// get funding codes
		funding: function (callback) {
			connection.query('SELECT * FROM fundingaccount;', callback);
		}
	},
	function (error, results) {
		response.render(path.join(__dirname + '/views/manager-logs.ejs'), { equipment: results.equipment[0], projects: results.projects[0], funding: results.funding[0], date: date});
	});
});

// generate new log
app.post('/manager-logs', authenticate, function(request,response) {
	// get information
	var equipment = request.body.equipment;
	var projects = request.body.projects;
	var funding = request.body.funding;
	var after;
	var before;
	// set after date
	if(request.body.after) { after = new Date(request.body.after); } else { after = new Date(0); }
	// set before date
	if(request.body.before) { before = new Date(request.body.before); } else { before = new Date; }
	// convert to UTC
	after = new Date(after - after.getTimezoneOffset() * 60000);
	after = after.toISOString().slice(0, 19).replace('T', ' ');
	before = new Date(before - before.getTimezoneOffset() * 60000);
	before = before.toISOString().slice(0, 19).replace('T', ' ');

	var query000 = 'SELECT * FROM booking INNER JOIN funds USING(projectName, accountNumber) WHERE startTime < ? AND startTime > ? ORDER BY startTime DESC INTO OUTFILE ? FIELDS TERMINATED BY ",";';
	var query100 = 'SELECT * FROM booking INNER JOIN funds USING(projectName, accountNumber) WHERE equipmentName IN (?) AND startTime < ? AND startTime > ? ORDER BY startTime DESC INTO OUTFILE ? FIELDS TERMINATED BY ",";';
	var query010 = 'SELECT * FROM booking INNER JOIN funds USING(projectName, accountNumber) WHERE projectName IN (?) AND startTime < ? AND startTime > ? ORDER BY startTime DESC INTO OUTFILE ? FIELDS TERMINATED BY ",";';
	var query001 = 'SELECT * FROM booking INNER JOIN funds USING(projectName, accountNumber) WHERE accountNumber IN (?) AND startTime < ? AND startTime > ? ORDER BY startTime DESC INTO OUTFILE ? FIELDS TERMINATED BY ",";';
	var query110 = 'SELECT * FROM booking INNER JOIN funds USING(projectName, accountNumber) WHERE equipmentName IN (?) AND projectName IN (?) AND startTime < ? AND startTime > ? ORDER BY startTime DESC INTO OUTFILE ? FIELDS TERMINATED BY ",";';
	var query011 = 'SELECT * FROM booking INNER JOIN funds USING(projectName, accountNumber) WHERE projectName IN (?) AND accountNumber IN (?) AND startTime < ? AND startTime > ? ORDER BY startTime DESC INTO OUTFILE ? FIELDS TERMINATED BY ",";';
	var query101 = 'SELECT * FROM booking INNER JOIN funds USING(projectName, accountNumber) WHERE equipmentName IN (?) AND accountNumber IN (?) AND startTime < ? AND startTime > ? ORDER BY startTime DESC INTO OUTFILE ? FIELDS TERMINATED BY ",";';
	var query111 = 'SELECT * FROM booking INNER JOIN funds USING(projectName, accountNumber) WHERE equipmentName IN (?) AND projectName IN (?) AND accountNumber IN (?) AND startTime < ? AND startTime > ? ORDER BY startTime DESC INTO OUTFILE ? FIELDS TERMINATED BY ",";';

	// delete old log
	if (fs.existsSync(logFILE)) {
		fs.unlinkSync(logFILE, function(error) {
			if (error) {
				throw error;
			}
		});
	}
	
	// select query depending on request and generate new file
	if (!equipment && !projects && !funding) {
		connection.query(query000, [before, after, logFILE], function (error, results, fields) {
			if (error) {
				throw error;
			} else {
				downloadLOG(request, response);
			}
		});
	} else if (equipment && !projects && !funding) {
		connection.query(query100, [equipment, before, after, logFILE], function (error, results, fields) {
			if (error) {
				throw error;
			} else {
				downloadLOG(request, response);
			}
		});
	} else if (!equipment && projects && !funding) {
		connection.query(query010, [projects, before, after, logFILE], function (error, results, fields) {
			if (error) {
				throw error;
			} else {
				downloadLOG(request, response);
			}
		});
	} else if (!equipment && !projects && funding) {
		connection.query(query001, [funding, before, after, logFILE], function (error, results, fields) {
			if (error) {
				throw error;
			} else {
				downloadLOG(request, response);
			}
		});
	} else if (equipment && projects && !funding) {
		connection.query(query110, [equipment, projects, before, after, logFILE], function (error, results, fields) {
			if (error) {
				throw error;
			} else {
				downloadLOG(request, response);
			}
		});
	} else if (!equipment && projects && funding) {
		connection.query(query011, [projects, funding, before, after, logFILE], function (error, results, fields) {
			if (error) {
				throw error;
			} else {
				downloadLOG(request, response);
			}
		});
	} else if (equipment && !projects && funding) {
		connection.query(query101, [equipment, funding, before, after, logFILE], function (error, results, fields) {
			if (error) {
				throw error;
			} else {
				downloadLOG(request, response);
			}
		});
	} else if (equipment && projects && funding) {
		connection.query(query111, [equipment, projects, funding, before, after, logFILE], function (error, results, fields) {
			if (error) {
				throw error;
			} else {
				downloadLOG(request, response);
			}
		});
	}
});

// generate a new maintenance report and call download
app.get('/generate-maintenance', function (request, response) {

	// delete old file
	if (fs.existsSync(maintenanceFILE)) {
		fs.unlinkSync(maintenanceFILE, function(error) {
			if (error) {
				throw error;
			}
		});
	}
	// generate new file
	connection.query('SELECT * FROM maintenancereport INTO OUTFILE ? FIELDS TERMINATED BY ",";',[maintenanceFILE], function (error, results, fields) {
		if (error) {
			throw error;
		} else {
			downloadREPORT(request, response);
		}
	});
});

// download the maintenance csv
app.get('/download-maintenance', downloadREPORT = function(request, response) {
	// send file for download
	response.download(maintenanceFILE, function(error) {
		if (error) {
			throw error
		}
	});
});

// download the log csv
app.get('/download-log', downloadLOG = function(request, response) {
	// send file for download
	response.download(logFILE, function(error) {
		if (error) {
			throw error
		}
	});
});

app.get('/manager-calendar', authenticateAdmin, function (req, res) {
    connection.connect(function (err) {
		var date = new Date();
		var username = req.session.username ;
        var booking_date = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
        var equipment_name = "";
        var page_data_array = {
            "booking_date": booking_date,
            "equipment_name": equipment_name,
            "month": date.getMonth(),
            "year": date.getFullYear(),
            "day": date.getDate()
		};
        async.parallel({
            equipment: function (callback) {
                connection.query("SELECT equipmentName FROM equipment;", callback);
            },
            projects: function (callback) {
                connection.query("SELECT projectName FROM project;", callback);
			},
			funds : function (callback) {
                connection.query('SELECT * FROM funds;', callback);
			},
			works_on: function (callback) {
                connection.query("SELECT * FROM worksOn WHERE username = '" + username + "';", callback);
            },
			usage_modes: function (callback) {
                connection.query("SELECT modes FROM usageMode WHERE equipmentName = '" + equipment_name + "';", callback);
            },
            funding_accounts: function (callback) {
                connection.query("SELECT accountNumber FROM fundingAccount;", callback);
            },
            bookings: function (callback) {
                connection.query("SELECT * FROM booking WHERE bookingDate = '" + booking_date + "' AND equipmentName = '" + equipment_name + "';", callback);
            }
        }, function (error, results) {
            try {
                if (error) throw error;
				else { // if there is no error in the query...
                    res.render(path.join(__dirname + '/views/manager-calendar.ejs'), {
                        page_data: page_data_array,
                        equipments: results.equipment[0],
						usageMode: results.usage_modes[0],
						works_on : results.works_on[0],
                        accounts: results.funding_accounts[0],
                        bookings: results.bookings[0],
						projects: results.projects[0],
						funds : results.funds[0]
                    });
                } // end if-else block (rendering data to the page)
            } catch (error) {
                res.status(400).send(error);
            }
        });   // end mysql.query
    });       // end mysql.connection
});           // end GET 


// Update the schedule on the bookings page based on what piece of equipment and date is selected
app.post("/update_schedule", authenticate, function (req, res) {
    connection.connect(function (err) {
        if (err) throw err;
        let booking_date = req.body.query_booking_date;
		let equipment_name = req.body.query_equipment_name;
		var year; var month; var day;
		var username = req.session.username ;

        if (booking_date.charAt(6) == "-") {
            year = booking_date.substring(0, 4);
            month = booking_date.substring(5, 6);
            if (booking_date.length == 8)
                day = booking_date.substring(7, 8);
            else
                day = booking_date.substring(7, 9);
        } else {
            var year = booking_date.substring(0, 4);
            var month = booking_date.substring(5, 7);
            if (booking_date.length == 9)
                day = booking_date.substring(8, 9);
            else
                day = booking_date.substring(8, 10);
        } month--;

        var page_data_array = {
            "booking_date": booking_date,
            "equipment_name": equipment_name,
            "month": month,
            "year": year,
            "day": day
        };
        async.parallel({
            equipment: function (callback) {
                connection.query("SELECT * FROM equipment;", callback);
            },
            projects: function (callback) {
                connection.query("SELECT projectName FROM project;", callback);
			},
			funds : function (callback) {
                connection.query('SELECT * FROM funds;', callback);
			},
			works_on: function (callback) {
                connection.query("SELECT * FROM worksOn WHERE username = '" + username + "';", callback);
            },
            usage_modes: function (callback) {
                connection.query("SELECT modes FROM usageMode WHERE equipmentName = '" + equipment_name + "';", callback);
            },
            funding_accounts: function (callback) {
                connection.query("SELECT accountNumber FROM fundingAccount;", callback);
            },
            bookings: function (callback) {
                connection.query("SELECT * FROM booking WHERE bookingDate = '" + booking_date + "' AND equipmentName = '" + equipment_name + "';", callback);
            }
        }, function (error, results) {
            try {
                if (error) throw error;
                else { // if there is no error in the query...
					res.render(path.join(__dirname + '/views/manager-calendar.ejs'), {
                        page_data: page_data_array,
                        equipments: results.equipment[0],
						usageMode: results.usage_modes[0],
						works_on : results.works_on[0],
                        accounts: results.funding_accounts[0],
                        bookings: results.bookings[0],
						projects: results.projects[0],
						funds : results.funds[0]
                    });
                } // end if-else block (rendering data to the page)
            } catch (error) {
                res.status(400).send(error);
            }
        });   // end mysql.query
    });     // end mysql.connection
});         // end POST 


// Receive booking submission, insert the data into the bookings table of the database, show confirmation/error to user
app.post("/submit_booking", authenticateAdmin, function (req, res) {
    connection.connect(function (err) {
        if (err) throw err; 

        let equipment_to_book = req.body.equipment_for_booking.trim();
        let booking_date = req.body.date_for_booking;
		let start_time = req.body.booking_start_time;
        let end_time = req.body.booking_end_time;
        let usage_mode = req.body.usage_mode;
        let technician = req.body.technician;
        let project = req.body.project;
        let funding_account = req.body.funding_account;
        let description = req.body.description;
        let pending = req.body.pending;
        let start_date_time = booking_date + " " + start_time;
		var username = req.session.username ;

        if (technician == undefined) 
            technician = 0;
        if (pending == undefined) 
            pending = 1;
        if (project == undefined) 
            project == "";
        var date_split = booking_date.split("-");
        var date_check = new Date(date_split[0], date_split[1] - 1, date_split[2], 0, 0, 0, 0);
        var day = date_check.getDay();
        var d = date_check.getDate() - day;
        var week_start = (new Date(date_check.setDate(d))).toString();
        var week_end = (new Date(date_check.setDate(d + 7))).toString();
        var week_start_split = week_start.split(" ");
        var month_dict = {
            "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6, "Jul": 7, "Aug": 8,
            "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12
		};

		var today = new Date();
		today = today.toString();
		var today_split = today.split(" ");
        var today_month = month_dict[today_split[1]];
        var new_today = today_split[3] + "-" + today_month + "-" + today_split[2];

        var start_month = month_dict[week_start_split[1]];
        var week_end_split = week_end.split(" ");
        var end_month = month_dict[week_end_split[1]];
        if (week_end_split[2] < week_start_split[2]) 
            end_month++;

        week_start = week_start_split[3] + "-" + start_month + "-" + week_start_split[2];
        week_end = week_end_split[3] + "-" + end_month + "-" + week_end_split[2];
        async.parallel({
            equip_info: function (callback) {
                connection.query("SELECT maxBookingTime, maxBookingsWeekly FROM equipment WHERE equipmentName = '" + equipment_to_book + "';", callback);
            },
            week_bookings: function (callback) {
                connection.query("SELECT * FROM booking WHERE equipmentName = '" + equipment_to_book + "' AND bookingDate BETWEEN '" + week_start +
                    "' AND '" + week_end + "';", callback);
            },
            user_bookings: function (callback) {
                connection.query("SELECT * FROM booking WHERE username = '" + username + "' AND bookingDate >= '" + new_today + "';", callback);
            },
        }, function (error, results) {
            try {
                if (error) throw error;
                else {
                    var info = results.equip_info[0];
                    var max_hours = info[0].maxBookingTime * 100;
                    var max_weekly = info[0].maxBookingsWeekly;
                    var time_span = 0;

                    var start = parseInt(start_time.replace(":", ""));
                    var end = parseInt(end_time.replace(":", ""));
                    if (end < start) {
                        time_span = (2400 - start) + end;
                    } else {
                        time_span = end - start;
                    }

                    if (time_span > max_hours) {
                        max_hours = max_hours / 100;
                        var page_data_array = { "max_hours": max_hours };
                        res.render(path.join(__dirname + '/views/manager-exceeded-hours.ejs'), {
                            page_data: page_data_array
                        });
                        res.end();
                        return;
                    } else if (results.week_bookings[0].length >= max_weekly) {
                        var page_data_array = { "max_weekly": max_weekly };
                        res.render(path.join(__dirname + '/views/manager-exceeded-weekly.ejs'), {
                            page_data: page_data_array
                        });
                        res.end();
                        return;
                    } else if (results.user_bookings[0].length >= 4) {
                        res.render(path.join(__dirname + '/views/manager-exceeded-bookings.ejs'));
                        res.end();
                        return;
                    } else {
                        let sql_query3 = `INSERT INTO booking VALUES ('${start_date_time}', '${equipment_to_book}', '${username}', '${funding_account}', '${project}', '${booking_date}', '${start_time}', '${end_time}','${usage_mode}', ${technician}, ${pending}, '${description}')`;
                        var confirmation = equipment_to_book + " for " + booking_date + " at " + start_time;
                        var page_data_array = { "confirmation": confirmation };

                        connection.query(sql_query3, function (err, result, fields) {
                            if (err) {
                                throw err;
                                res.render(path.join(__dirname + '/views/bookings_error.ejs'));
                                res.end();
                                return;
                            } else {
                                res.render(path.join(__dirname + '/views/bookings_confirmation.ejs'), {
                                    page_data: page_data_array
                                });
                                res.end();
                                return;
                            } // end if/else INNER
                        }); // end mysql.query
                    } // end if-else block OUTER
                } // end rendering
            } catch (error) {
               res.status(400).send(error);
            } // end try-catch block
        });   // end mysql.query
    });     // end mysql.connection
});         // end POST 


app.get('/manager-booking', authenticateAdmin, function (req, res) {
    connection.connect(function (err) {
        async.parallel({
            equipment: function (callback) {
                connection.query("SELECT equipmentName FROM equipment;", callback);
            },
            users: function (callback) {
                connection.query("SELECT username FROM users;", callback);
            },
            projects: function (callback) {
                connection.query("SELECT projectName FROM project;", callback);
            },
            funding: function (callback) {
                connection.query("SELECT accountNumber FROM fundingAccount;", callback);
            },
            usage_modes: function (callback) {
                connection.query("SELECT modes FROM usageMode;", callback);
            },
            funding_accounts: function (callback) {
                connection.query("SELECT accountNumber FROM fundingAccount;", callback);
            },
            bookings: function (callback) {
                connection.query("SELECT * FROM booking ORDER BY bookingDate DESC;", callback);
            }
        }, function (error, results) {
            try {
                if (error) throw error;
                else { // if there is no error in the query...
                    res.render(path.join(__dirname + '/views/manager-booking.ejs'), {
                        equipments: results.equipment[0],
                        users: results.users[0],
                        modes: results.usage_modes[0],
                        projects: results.projects[0],
                        funding_accounts: results.funding[0],
                        accounts: results.funding_accounts[0],
                        bookings: results.bookings[0]
                    });
                } // end if-else block (rendering data to the page)
            } catch (error) {
                res.status(400).send(error);
            }
        });   // end mysql.query
    });       // end mysql.connection
});           // end GET 


app.post('/filter_entries', authenticate, function (req, res) {
    let equipment = req.body.equipment.trim();
    let search_date = req.body.date;
    let user = req.body.user;
    let usage_mode = req.body.usage_mode;
    let technician = parseInt(req.body.technician);
    let funding = req.body.funding;
    let project = req.body.project;
    var query_counter = 0;
    var base_query = " WHERE ";
    var booking_query = "";

    if (search_date == "YYYY-MM-DD")
        search_date = "";
    if (equipment) {
        base_query = base_query + "equipmentName = '" + equipment + "' AND ";
        query_counter++;
    } if (search_date) {
        base_query = base_query + "bookingDate LIKE '%" + search_date + "%' AND ";
        query_counter++;
    } if (user) {
        base_query = base_query + "username = '" + user + "' AND ";
        query_counter++;
    } if (usage_mode) {
        base_query = base_query + "usageMode = '" + usage_mode + "' AND ";
        query_counter++;
    } if (technician == 1 || technician == 0) {
        base_query = base_query + "requireTechnician = " + technician.toString() + " AND ";
        query_counter++;
    } if (funding) {
        base_query = base_query + "accountNumber = '" + funding + "' AND ";
        query_counter++;
    } if (technician == 1 || technician == 0) {
        base_query = base_query + "projectName = " + project + " AND ";
        query_counter++;
    }

    base_query = base_query.substring(0, base_query.length - 5);
    if (query_counter > 0)
        booking_query = "SELECT * FROM booking " + base_query + " ORDER BY bookingDate DESC;;";
    else
        booking_query = "SELECT * FROM booking ORDER BY bookingDate DESC;";

    connection.connect(function (err) {
        async.parallel({
            equipment: function (callback) {
                connection.query("SELECT equipmentName FROM equipment;", callback);
            },
            projects: function (callback) {
                connection.query("SELECT projectName FROM project;", callback);
            },
            funding: function (callback) {
                connection.query("SELECT accountNumber FROM fundingAccount;", callback);
            },
            users: function (callback) {
                connection.query("SELECT username FROM users;", callback);
            },
            usage_modes: function (callback) {
                connection.query("SELECT modes FROM usageMode;", callback);
            },
            bookings: function (callback) {
                connection.query(booking_query, callback);
            }
        }, function (error, results) {
            try {
                if (error) throw error;
                else { // if there is no error in the query...
                    res.render(path.join(__dirname + '/views/manager-booking.ejs'), {
                        equipments: results.equipment[0],
                        users: results.users[0],
                        modes: results.usage_modes[0],
                        projects: results.projects[0],
                        funding_accounts: results.funding[0],
                        bookings: results.bookings[0]
                    });
                } // end if-else block (rendering data to the page)
            } catch (error) {
                res.status(400).send(error);
            }
        });   // end mysql.query
    });       // end mysql.connection
});           // end GET 


app.get('/manager_requests', authenticateAdmin, function (req, res) {
+	connection.connect(function (err) {
        async.parallel({
            equipment: function (callback) {
                connection.query("SELECT equipmentName FROM equipment;", callback);
            },
            bookings: function (callback) {
                connection.query("SELECT startDateTime, equipmentName, username, accountNumber, projectName, bookingDate, startTime, endTime, usageMode, requireTechnician, description FROM booking WHERE pending = 1 ORDER BY bookingDate DESC;", callback);
            }
        }, function (error, results) {
            try {
                if (error) throw error;
                else { // if there is no error in the query...
                    res.render(path.join(__dirname + '/views/manager_requests.ejs'), {
                        equipments: results.equipment[0],
                        bookings: results.bookings[0]
                    });
                } // end if-else block (rendering data to the page)
            } catch (error) {
                res.status(400).send(error);
            }
        });   // end mysql.query
    });       // end mysql.connection
});           // end GET 

app.post('/accept_booking', authenticateAdmin, function (req, res) {
    let equipment = req.body.equipment;
    let date = req.body.date;
    let start_time = req.body.start_time;
    var date_split = date.split(" ");
    var month_dict = {
        "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6, "Jul": 7, "Aug": 8,
        "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12
    };
    var month = month_dict[date_split[1]];
    date = date_split[3] + "-" + month + "-" + date_split[2];

    connection.connect(function (err) {
        async.parallel({
            request: function (callback) {
                connection.query("UPDATE booking SET pending = 0 WHERE equipmentName = '" + equipment + "' AND startTime = '" + start_time + "' AND bookingDate = '" + date + "' ;", callback);
            },
            equipment: function (callback) {
                connection.query("SELECT equipmentName FROM equipment;", callback);
            },
            bookings: function (callback) {
                connection.query("SELECT startDateTime, equipmentName, username, bookingDate, startTime, endTime, usageMode, requireTechnician, description FROM booking WHERE pending = 1 ORDER BY bookingDate DESC;", callback);
            }
        }, function (error, results) {
            try {
                if (error) throw error;
                else { // if there is no error in the query...
                    res.render(path.join(__dirname + '/views/manager_requests.ejs'), {
                        equipments: results.equipment[0],
                        bookings: results.bookings[0]
                    });
                } // end if-else block (rendering data to the page)
            } catch (error) {
                res.status(400).send(error);
            }
        });   // end mysql.query
    });       // end mysql.connection
});           // end GET 

app.post('/deny_booking', authenticateAdmin, function (req, res) {
    let equipment = req.body.equipment;
    let date = req.body.date;
    let start_time = req.body.start_time;
    var date_split = date.split(" ");
    var month_dict = {
        "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6, "Jul": 7, "Aug": 8,
        "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12
    };
    var month = month_dict[date_split[1]];
    date = date_split[3] + "-" + month + "-" + date_split[2];

    connection.connect(function (err) {
        async.parallel({
            request: function (callback) {
                connection.query("DELETE FROM booking WHERE equipmentName = '" + equipment + "' AND startTime = '" + start_time + "' AND bookingDate = '" + date + "' ;", callback);
            },
            equipment: function (callback) {
                connection.query("SELECT equipmentName FROM equipment;", callback);
            },
            bookings: function (callback) {
                connection.query("SELECT startDateTime, equipmentName, username, bookingDate, startTime, endTime, usageMode, requireTechnician, description FROM booking WHERE pending = 1 ORDER BY bookingDate DESC;", callback);
            }
        }, function (error, results) {
            try {
                if (error) throw error;
                else { // if there is no error in the query...
                    res.render(path.join(__dirname + '/views/manager_requests.ejs'), {
                        equipments: results.equipment[0],
                        bookings: results.bookings[0]
                    });
                } // end if-else block (rendering data to the page)
            } catch (error) {
                res.status(400).send(error);
            }
        });   // end mysql.query
    });       // end mysql.connection
});           // end GET  

app.get('/user-calendar', authenticate, function (req, res) {
	var username = req.session.username; 
	
	connection.connect(function (err) {
        let date = new Date();
        var booking_date = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
        var equipment_name = "";
        var page_data_array = {
            "booking_date": booking_date,
            "equipment_name": equipment_name,
            "month": date.getMonth(),
            "year": date.getFullYear(),
            "day": date.getDate()
        };

        async.parallel({
            equipment: function (callback) {
                connection.query("SELECT equipmentName FROM equipment;", callback);
            },
            projects: function (callback) {
                connection.query("SELECT projectName FROM project;", callback);
            },
			usage_modes: function (callback) {
                connection.query("SELECT modes FROM usageMode WHERE equipmentName = '" + equipment_name + "';", callback);
            },
			works_on: function (callback) {
                connection.query("SELECT * FROM worksOn WHERE username = '" + username + "';", callback);
            },
            funding_accounts: function (callback) {
                connection.query("SELECT accountNumber FROM fundingaccount;", callback);
			},
			funds : function (callback) {
                connection.query('SELECT * FROM funds;', callback);
			},
            bookings: function (callback) {
                connection.query("SELECT * FROM booking WHERE bookingDate = '" + booking_date + "' AND equipmentName = '" + equipment_name + "';", callback);
            }
        }, function (error, results) {
            try {
                if (error) throw error;
                else { // if there is no error in the query...
                    res.render(path.join(__dirname + '/views/user-calendar.ejs'), {
                        page_data: page_data_array,
						equipments: results.equipment[0],
						worksOn: results.works_on[0],
						funds: results.funds[0],
                        usageMode: results.usage_modes[0],
                        accounts: results.funding_accounts[0],
                        bookings: results.bookings[0],
                        projects: results.projects[0]
                    });
                } // end if-else block (rendering data to the page)
            } catch (error) {
                res.status(400).send(error);
            }
        });   // end mysql.query
    });       // end mysql.connection
});           // end GET 


// Update the schedule on the bookings page based on what piece of equipment and date is selected
app.post("/update_schedule_user", authenticate, function (req, res) {
	var username = req.session.username;
	connection.connect(function (err) {
        if (err) console.log(err);
        let booking_date = req.body.query_booking_date;
        let equipment_name = req.body.query_equipment_name;
        var year; var month; var day;

        if (booking_date.charAt(6) == "-") {
            year = booking_date.substring(0, 4);
            month = booking_date.substring(5, 6);
            if (booking_date.length == 8)
                day = booking_date.substring(7, 8);
            else
                day = booking_date.substring(7, 9);
        } else {
            var year = booking_date.substring(0, 4);
            var month = booking_date.substring(5, 7);
            if (booking_date.length == 9)
                day = booking_date.substring(8, 9);
            else
                day = booking_date.substring(8, 10);
        } month--;

        var page_data_array = {
            "booking_date": booking_date,
            "equipment_name": equipment_name,
            "month": month,
            "year": year,
            "day": day
        };
        async.parallel({
            equipment: function (callback) {
                connection.query("SELECT equipmentName FROM equipment;", callback);
            },
            projects: function (callback) {
                connection.query("SELECT projectName FROM project;", callback);
            },
			usage_modes: function (callback) {
                connection.query("SELECT modes FROM usageMode WHERE equipmentName = '" + equipment_name + "';", callback);
            },
			works_on: function (callback) {
                connection.query("SELECT * FROM worksOn WHERE username = '" + username + "';", callback);
            },
            funding_accounts: function (callback) {
                connection.query("SELECT accountNumber FROM fundingaccount;", callback);
			},
			funds : function (callback) {
                connection.query('SELECT * FROM funds;', callback);
			},
            bookings: function (callback) {
                connection.query("SELECT * FROM booking WHERE bookingDate = '" + booking_date + "' AND equipmentName = '" + equipment_name + "';", callback);
            }
        }, function (error, results) {
            try {
                if (error) throw error;
                else { // if there is no error in the query...
                    res.render(path.join(__dirname + '/views/user-calendar.ejs'), {
                        page_data: page_data_array,
						equipments: results.equipment[0],
						worksOn: results.works_on[0],
						funds: results.funds[0],
                        usageMode: results.usage_modes[0],
                        accounts: results.funding_accounts[0],
                        bookings: results.bookings[0],
                        projects: results.projects[0]
                    });
                } // end if-else block (rendering data to the page)
            } catch (error) {
                res.status(400).send(error);
            }
        });   // end mysql.query
    });     // end mysql.connection
});         // end POST 


// Receive booking submission, insert the data into the bookings table of the database, show confirmation/error to user
app.post("/submit_booking_user", authenticate, function (req, res) {
    connection.connect(function (err) {
        if (err) console.log(err);

        let equipment_to_book = req.body.equipment_for_booking.trim();
        let booking_date = req.body.date_for_booking;
        let start_time = req.body.booking_start_time;
        let end_time = req.body.booking_end_time;
        let usage_mode = req.body.usage_mode;
        let technician = req.body.technician;
        let project = req.body.project;
        let funding_account = req.body.funding_account;
        let description = req.body.description;
        let pending = req.body.pending;
        let start_date_time = booking_date + " " + start_time;
		var username = req.session.username ;

        if (technician == undefined) 
            technician = 0;
        if (pending == undefined) 
            pending = 1;
        if (project == undefined) 
            project == "";
        var date_split = booking_date.split("-");
        var date_check = new Date(date_split[0], date_split[1] - 1, date_split[2], 0, 0, 0, 0);
        var day = date_check.getDay();
        var d = date_check.getDate() - day;
        var week_start = (new Date(date_check.setDate(d))).toString();
        var week_end = (new Date(date_check.setDate(d + 7))).toString();
        var week_start_split = week_start.split(" ");
        var month_dict = {
            "Jan": 1, "Feb": 2, "Mar": 3, "Apr": 4, "May": 5, "Jun": 6, "Jul": 7, "Aug": 8,
            "Sep": 9, "Oct": 10, "Nov": 11, "Dec": 12
		};

        var today = new Date();
        today = today.toString();
		var today_split = today.split(" ");
        var today_month = month_dict[today_split[1]];
        var new_today = today_split[3] + "-" + today_month + "-" + today_split[2];

        var start_month = month_dict[week_start_split[1]];
        var week_end_split = week_end.split(" ");
        var end_month = month_dict[week_end_split[1]];
        if (week_end_split[2] < week_start_split[2]) 
            end_month++;

        week_start = week_start_split[3] + "-" + start_month + "-" + week_start_split[2];
        week_end = week_end_split[3] + "-" + end_month + "-" + week_end_split[2];
        async.parallel({
            equip_info: function (callback) {
                connection.query("SELECT maxBookingTime, maxBookingsWeekly FROM equipment WHERE equipmentName = '" + equipment_to_book + "';", callback);
            },
            week_bookings: function (callback) {
                connection.query("SELECT * FROM booking WHERE equipmentName = '" + equipment_to_book + "' AND bookingDate BETWEEN '" + week_start +
                    "' AND '" + week_end + "';", callback);
            },
            user_bookings: function (callback) {
                connection.query("SELECT * FROM booking WHERE username = '" + username + "' AND bookingDate >= '" + new_today + "';", callback);
            },
        }, function (error, results) {
            try {
                if (error) throw error;
                else {
                    var info = results.equip_info[0];
                    var max_hours = info[0].maxBookingTime * 100;
                    var max_weekly = info[0].maxBookingsWeekly;
                    var time_span = 0;

                    var start = parseInt(start_time.replace(":", ""));
                    var end = parseInt(end_time.replace(":", ""));
                    if (end < start) {
                        time_span = (2400 - start) + end;
                    } else {
                        time_span = end - start;
                    }

                    if (time_span > max_hours) {
                        max_hours = max_hours / 100;
                        var page_data_array = { "max_hours": max_hours };
                        res.render(path.join(__dirname + '/views/user-exceeded-hours.ejs'), {
                            page_data: page_data_array
                        });
                        res.end();
                        return;
                    } else if (results.week_bookings[0].length >= max_weekly) {
                        var page_data_array = { "max_weekly": max_weekly };
                        res.render(path.join(__dirname + '/views/user-exceeded-weekly.ejs'), {
                            page_data: page_data_array
                        });
                        res.end();
                        return;
                    } else if (results.user_bookings[0].length >= 4) {
                        res.render(path.join(__dirname + '/views/user-exceeded-bookings.ejs'));
                        res.end();
                        return;
                    } else {
                        let sql_query3 = `INSERT INTO booking VALUES ('${start_date_time}', '${equipment_to_book}', '${username}', '${funding_account}', '${project}', '${booking_date}', '${start_time}', '${end_time}','${usage_mode}', ${technician}, ${pending}, '${description}')`;
                        var confirmation = equipment_to_book + " for " + booking_date + " at " + start_time;
                        var page_data_array = { "confirmation": confirmation };

                        connection.query(sql_query3, function (err, result, fields) {
                            if (err) {
                                console.log(err);
                                res.render(path.join(__dirname + '/views/user-bookings-error.ejs'));
                                res.end();
                                return;
                            } else {
                                res.render(path.join(__dirname + '/views/user-bookings-confirmation.ejs'), {
                                    page_data: page_data_array
                                });
                                res.end();
                                return;
                            } // end if/else INNER
                        }); // end mysql.query
                    } // end if-else block OUTER
                } // end rendering
            } catch (error) {
                console.log(error);
            } // end try-catch block
        });   // end mysql.query
    });     // end mysql.connection
});         // end POST 


app.get('/booking', authenticate, function (req, res) {
    var username = req.session.username;
    connection.connect(function (err) {
        async.parallel({
            bookings: function (callback) {
                connection.query(`SELECT * FROM booking WHERE username = '${username}' ORDER BY bookingDate DESC;`, callback);
            }
        }, function (error, results) {
            try {
                if (error) throw error;
                else { // if there is no error in the query...
                    res.render(path.join(__dirname + '/views/user-bookings.ejs'), {
						bookings: results.bookings[0]
                    });
                } // end if-else block (rendering data to the page)
            } catch (error) {
                res.status(400).send(error);
            }
        });   // end mysql.query
    });       // end mysql.connection
});           // end GET 

app.get('/user-requests', authenticate, function (req, res) {
	var username = req.session.username;
	connection.connect(function (err) {
        async.parallel({
            equipment: function (callback) {
                connection.query("SELECT equipmentName FROM equipment;", callback);
            },
            bookings: function (callback) {
                connection.query("SELECT * FROM booking WHERE pending = 1 AND username = '" + username + "' ORDER BY bookingDate DESC;", callback);
            }
        }, function (error, results) {
            try {
                if (error) throw error;
                else { // if there is no error in the query...
                    res.render(path.join(__dirname + '/views/user-requests.ejs'), {
                        equipments: results.equipment[0],
                        bookings: results.bookings[0]
                    });
                } // end if-else block (rendering data to the page)
            } catch (error) {
                res.status(400).send(error);
            }
        });   // end mysql.query
    });       // end mysql.connection
});           // end GET 


// delete booking function for users 
app.post('/delete-booking', authenticate, function(request, response) { 
	var booking = request.body.selectedBooking; 
	var equipment = request.body.selectedEquipment;

	if (typeof booking == 'undefined' || typeof equipment == 'undefined') { 
		response.redirect('/booking');
	} else { 
		
		if (typeof booking == 'string') { 
			booking = [booking];
		}
		if (typeof equipment == 'string') { 
			equipment = [equipment];
		}

		var selected = [];

		for (i = 0; i < booking.length; i++) { 
			selected.push([booking[i], equipment[i]]);
		}
		async.forEachOf(selected, function(value, key, callback) {
			var now = new Date();	// current datetime 
			var booking = new Date(selected[key][0]);	// booking datetime 
			
			// convert from JSON date object to MySQL compatible YYYY-MM-DD HH:mm:ss
			var converted_now = datetimeConverter(now);
			var converted_booking = datetimeConverter(booking);

			var equipment = selected[key][1];

			// do not delete if booking datetime has started/passed 
			if (converted_now >= converted_booking) { 
				return; 
			} else { 
				connection.query('DELETE FROM booking WHERE startDateTime = ? AND equipmentName = ?', [converted_booking, equipment], function(error, results, fields) { 
					if (error) { 
						throw error; 
					}
				});
			}
		});
		response.redirect('/booking');
	}
});

// delete booking function for managers 
app.post('/manager-delete-booking', authenticateAdmin, function(request, response) { 
	var booking = request.body.selectedBooking; 
	var equipment = request.body.selectedEquipment;

	if (typeof booking == 'undefined' || typeof equipment == 'undefined') { 
		response.redirect('/manager-booking');
	} else { 
		
		if (typeof booking == 'string') { 
			booking = [booking];
		}
		if (typeof equipment == 'string') { 
			equipment = [equipment];
		}

		var selected = [];

		for (i = 0; i < booking.length; i++) { 
			selected.push([booking[i], equipment[i]]);
		}
		async.forEachOf(selected, function(value, key, callback) {
			var now = new Date();	// current datetime 
			var booking = new Date(selected[key][0]);	// booking datetime 
			
			// convert from JSON date object to MySQL compatible YYYY-MM-DD HH:mm:ss
			var converted_now = datetimeConverter(now);
			var converted_booking = datetimeConverter(booking);

			var equipment = selected[key][1];

			// do not delete if booking datetime has started/passed 
			if (converted_now >= converted_booking) { 
				return; 
			} else { 
				connection.query('DELETE FROM booking WHERE startDateTime = ? AND equipmentName = ?', [converted_booking, equipment], function(error, results, fields) { 
					if (error) { 
						throw error; 
					}
				});
			}
		});
		response.redirect('/manager-booking');
	}
});

// convert JSON datetime object to MySQL datetime format (YYYY-MM-DD HH:mm:ss)
function datetimeConverter(input) { 
	
	// parse input datetime object 
	var year = input.getFullYear();
	var month = input.getMonth() + 1;
	var day = input.getDate();
	var hour = input.getHours();
	var minute = input.getMinutes();
	var second = input.getSeconds();
	
	// add padding to follow format YYYY-MM-DD HH:mm:ss if singular digits exist 
	if (month < 10) { 
		month = '0' + month; 
	}
	if (day < 10) { 
		day = '0' + day; 
	}
	if (hour < 10) { 
		hour = '0' + hour; 
	}
	if (minute < 10) { 
		minute = '0' + minute; 
	}
	if (second < 10) { 
		second = '0' + second; 
	}

	var date = year + '-' + month + '-' + day; 
	var time = hour + ':' + minute + ':' + second;
	return datetime = date + ' ' + time; 
}

// convert text representation of boolean values from TRUE/FALSE to 0/1 for use with MySQL tinyint() storage
function booleanToInteger(variable) {
	if (variable == "true") { 
		variable = 1; 
	} else { 
		variable = 0; 
	}
	return variable;
}

// convert MySQL tinyint boolean values to text representation for displaying on webpage
function integerToBoolean(variable) { 
	if (variable == 1) { 
		variable = "On";
	} else { 
		variable = "Off";
	}
	return variable; 
}

// user authentication upon login 
app.post('/auth', function(request, response) {
	var username = request.body.username;
	var password = request.body.password;
	// check username and password entered
	if (username && password) {
		connection.query('SELECT * FROM users WHERE username = ?', [username], function (error, results, fields) {

			if (results.length > 0) {
                // store queried data in variable 
				var dbpass = results[0].password;
				var isAdmin = results[0].admin;
                // compare hashed passwords
                bcrypt.compare(password, dbpass, function(error, result) {
                    
                    // if passwords match 
                    if (result) {
						// set session variables 
						request.session.loggedIn = true;
						request.session.username = username;
						request.session.admin = isAdmin; 

						// redirect to appropriate homepage 
						if (isAdmin == 1) { 
                            response.redirect('/manager-homepage');
                        } else {
                            response.redirect('/homepage');
						}
                    } else { 
                        response.render(path.join(__dirname + '/views/login.ejs'), { message: "Incorrect username and/or password."});
                    }
                });
            } else {
                response.render(path.join(__dirname + '/views/login.ejs'), { message: "Incorrect username and/or password."});
            }
		});
	// username or password not entered
	} else {
		response.render(path.join(__dirname + '/views/login.ejs'), { message: "Please enter a username and password."});
	}
});

// check that user is logged in 
function authenticate(request, response, next) {
	// if logged in, allow access 
	if (request.session.loggedIn) {
		return next();
	} else { 
		response.redirect('/login');
	}
}

// role based access control for admin
function authenticateAdmin(request, response, next) { 
	// if logged in and is admin, allow access
	if (request.session.loggedIn) { 
		if (request.session.admin == true) { 
			return next();
		} else { 
			response.redirect('/logout');
		}
	} else { 
		response.redirect('/login');
	}
}

// terminate session and redirect to login page
app.get('/logout', function(request, response) {
	request.session.destroy();
	response.redirect('/login');
});

app.listen(8080);
