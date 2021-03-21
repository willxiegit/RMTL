/* RMTL Equipment Booking System DDL */ 

CREATE TABLE  announcements(
	title varchar(50),
	content varchar(500),
	posted datetime,
	id int NOT NULL AUTO_INCREMENT,
	PRIMARY KEY (id)
);

CREATE TABLE  users(
	username VARCHAR(50) NOT NULL,
	password CHAR(60) NOT NULL,
	firstName VARCHAR(50) NOT NULL,
	lastName VARCHAR(50) NOT NULL,
	email VARCHAR(50) NOT NULL,
	admin BOOLEAN,
	PRIMARY KEY (username)
);

CREATE TABLE  supervisor(
	username VARCHAR(50) NOT NULL,
	PRIMARY KEY (username),
	FOREIGN KEY (username)
		REFERENCES users(username)
		ON DELETE CASCADE 		
);

CREATE TABLE  fundingAccount(
	accountNumber VARCHAR(50) NOT NULL,
	PRIMARY KEY (accountNumber)
);

CREATE TABLE project (
	projectName VARCHAR(50) NOT NULL,
	description VARCHAR(100),
	PRIMARY KEY (projectName)
);


CREATE TABLE equipment (
	equipmentName VARCHAR(50) NOT NULL,
	location VARCHAR(50) NOT NULL,
	enableSensitive BOOLEAN DEFAULT False,
	allowConsecutive BOOLEAN DEFAULT False,
	maxBookingsWeekly INT,
	maxBookingTime INT,
	enablePrimetime BOOLEAN DEFAULT False,
	PRIMARY KEY (equipmentName)	
);



CREATE TABLE  booking(
	startDateTime datetime NOT NULL, 
	equipmentName VARCHAR(50) NOT NULL,
	username VARCHAR(50) NOT NULL, 
	accountNumber VARCHAR(20) NOT NULL,
	projectName VARCHAR(50) NOT NULL,
	bookingDate DATE, 
	startTime TIME NOT NULL,
	endTime TIME NOT NULL,
	usageMode VARCHAR(50),
	requireTechnician BOOLEAN,
	pending BOOLEAN DEFAULT FALSE,
	description VARCHAR(100) NOT NULL,
	PRIMARY KEY (equipmentName, startDateTime), 
	FOREIGN KEY (username)
		REFERENCES users(username)
		ON DELETE CASCADE,
	FOREIGN KEY (equipmentName) 
		REFERENCES equipment(equipmentName) 
		ON DELETE CASCADE
);

CREATE TABLE  trainingGroup(
	groupName VARCHAR(50) NOT NULL,
	PRIMARY KEY (groupName)
);


CREATE TABLE  primetime(
	equipmentName VARCHAR(50) NOT NULL,
	startTime TIME NOT NULL,
	endTime TIME NOT NULL,
	enforceSat BOOLEAN DEFAULT False,
	enforceSun BOOLEAN DEFAULT False,
	allowConsecutive BOOLEAN DEFAULT False,
	maxBookingTime INT,
	FOREIGN KEY (equipmentName) 
		REFERENCES equipment(equipmentName)
		ON DELETE CASCADE
);

CREATE TABLE maintenanceReport (
	user VARCHAR(50),
	equipmentName VARCHAR(50) NOT NULL,
	submitted TIMESTAMP,
	description VARCHAR(100) NOT NULL,
	urgency ENUM('High', 'Medium', 'Low'),
	activity ENUM('Pending','Confirmed','Resolved'),
    fixedOn TIMESTAMP,
	PRIMARY KEY ( equipmentName,submitted)
);

CREATE TABLE usageMode(
	equipmentName VARCHAR(50) NOT NULL, 
    modes VARCHAR(50) NOT NULL, 
    PRIMARY KEY (equipmentName, modes),
    FOREIGN KEY (equipmentName)
    	REFERENCES equipment(equipmentName)
    	ON DELETE CASCADE
   );

CREATE TABLE inGroup(
	username VARCHAR(50),
	groupName VARCHAR(50),
	FOREIGN KEY(username)
		REFERENCES users(username)
		ON DELETE CASCADE,
	FOREIGN KEY(groupName)
		REFERENCES trainingGroup(groupName)
		ON DELETE CASCADE	
);

CREATE TABLE trainedFor(
	groupName VARCHAR(50),
	equipmentName VARCHAR(50),
	FOREIGN KEY (groupName)
		REFERENCES trainingGroup(groupName)
		ON DELETE CASCADE,
	FOREIGN KEY (equipmentName)
		REFERENCES equipment(equipmentName)
		ON DELETE CASCADE
);


CREATE TABLE worksOn(
	username VARCHAR(50),
	projectName VARCHAR(50),
	FOREIGN KEY (username)
		REFERENCES users(username)
		ON DELETE CASCADE,
	FOREIGN KEY (projectName)
		REFERENCES project(projectName)
		ON DELETE CASCADE
);


CREATE TABLE has(
	username VARCHAR(50),
	accountNumber VARCHAR(50),
	FOREIGN KEY (username)	
		REFERENCES supervisor(username)
		ON DELETE CASCADE,
	FOREIGN KEY (accountNumber)
		REFERENCES fundingAccount(accountNumber)
		ON DELETE CASCADE
);

CREATE TABLE funds(
	projectName VARCHAR(50),
	accountNumber VARCHAR(50),
	FOREIGN KEY (projectName)
		REFERENCES project(projectName)
		ON DELETE CASCADE,
	FOREIGN KEY (accountNumber)
		REFERENCES fundingAccount(accountNumber)
		ON DELETE CASCADE
);

CREATE TABLE sessions(
	session_id varchar(128) NOT NULL,
	expires int UNSIGNED NOT NULL,
	data MEDIUMTEXT,
	PRIMARY KEY (session_id)
);
