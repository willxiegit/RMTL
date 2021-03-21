/* Data to initialize RMTL Equipment Booking System */ 

INSERT INTO announcements (title, content, posted) VALUES ('Welcome!', 'Welcome to the RMTL Equipment Booking System.', NOW());
INSERT INTO announcements (title, content, posted) VALUES ('Warning!', 'Please ensure that there is always at least one announcement present in the announcement board. 
We recommend keeping a default welcome message posted at all times.', NOW());

INSERT INTO users VALUES ('admin1', '$2b$10$.gtqeACCudrHXnnyIOsVuOZWTCT9inNao6hLBMRjT3V3UsMvhUY3u', 'firstname', 'lastname', 'email_address, 1); 
INSERT INTO users VALUES ('admin2', '$2b$10$Xl/TsdaGuLvfg2hHW8vmSO/eS3ArRBfxnvLrNt858mfjd487jhVv2', 'firstname', 'lastname', 'email_address', 1);

INSERT INTO supervisor VALUES ('admin1'); 
 
INSERT INTO fundingAccount VALUES ('392720');
INSERT INTO fundingAccount VALUES ('392787');

INSERT INTO has VALUES ('admin1', '392720'); 
INSERT INTO has VALUES ('admin1', '392787');

INSERT INTO trainingGroup VALUES ('Default');
INSERT INTO trainingGroup VALUES ('Level 1'); 
INSERT INTO trainingGroup VALUES ('Level 2');
INSERT INTO trainingGroup VALUES ('Level 3');
INSERT INTO trainingGroup VALUES ('SEM User');
INSERT INTO trainingGroup VALUES ('Mechanical Test');
INSERT INTO trainingGroup VALUES ('TEM User');

INSERT INTO inGroup VALUES ('admin1', 'Default');
INSERT INTO inGroup VALUES ('admin1', 'Level 1');
INSERT INTO inGroup VALUES ('admin1', 'Level 2');
INSERT INTO inGroup VALUES ('admin1', 'Level 3');
INSERT INTO inGroup VALUES ('admin1', 'Mechanical Test');
INSERT INTO inGroup VALUES ('admin1', 'SEM User');
INSERT INTO inGroup VALUES ('admin1', 'TEM User');
INSERT INTO inGroup VALUES ('admin2', 'Default');
INSERT INTO inGroup VALUES ('admin2', 'Level 1');
INSERT INTO inGroup VALUES ('admin2', 'Level 2');
INSERT INTO inGroup VALUES ('admin2', 'Level 3');
INSERT INTO inGroup VALUES ('admin2', 'Mechanical Test');
INSERT INTO inGroup VALUES ('admin2', 'SEM User');
INSERT INTO inGroup VALUES ('admin2', 'TEM User');

INSERT INTO project VALUES ('Hydride in Zirconium', '');
INSERT INTO project VALUES ('X750 Spacer Irradiation', '');
INSERT INTO project VALUES ('Default', '');

INSERT INTO funds VALUES ('Hydride in Zirconium', '392720');
INSERT INTO funds VALUES ('X750 Spacer Irradiation', '392787');

INSERT INTO worksOn VALUES ('admin1', 'Hydride in Zirconium'); 
INSERT INTO worksOn VALUES ('admin1', 'X750 Spacer Irradiation'); 
INSERT INTO worksOn VALUES ('admin1', 'Default');
INSERT INTO worksOn VALUES ('admin2', 'Default');

INSERT INTO equipment VALUES ('OSIRIS S/TEM', 'RMTL', 1, 1, 2, 9, 1);
INSERT INTO equipment VALUES ('Nano SEM', 'RMTL', 1, 1, 2, 24, 1);
INSERT INTO equipment VALUES ('Nano Indentor', 'RMTL', 1, 1, 5, 24, 1);
INSERT INTO equipment VALUES ('WTS Sample Preparation', 'Waste Transfer Station', 0, 1, 2, 9, 1);
INSERT INTO equipment VALUES ('Tandem Accelerator', 'RMTL', 1, 1, 7, 24, 1);

INSERT INTO usageMode VALUES ('OSIRIS S/TEM', 'Conventional S/TEM 200keV');
INSERT INTO usageMode VALUES ('OSIRIS S/TEM', 'Manetic sample require heating stage');
INSERT INTO usageMode VALUES ('OSIRIS S/TEM', 'In-situ straining at RT');
INSERT INTO usageMode VALUES ('OSIRIS S/TEM', 'In-situ heating');

INSERT INTO usageMode VALUES ('Nano SEM', 'Conventional SEM/EBSD');
INSERT INTO usageMode VALUES ('Nano SEM', 'TKD');
INSERT INTO usageMode VALUES ('Nano SEM', 'In-situ straining at temperatures');
INSERT INTO usageMode VALUES ('Nano SEM', 'In-situ nano-indentation');

INSERT INTO usageMode VALUES ('Nano Indentor', 'RT indentation');
INSERT INTO usageMode VALUES ('Nano Indentor', 'High temperature indentation');

INSERT INTO usageMode VALUES ('WTS Sample Preparation', 'Struers diamond cutter');
INSERT INTO usageMode VALUES ('WTS Sample Preparation', 'Sample grinding/polishing');

INSERT INTO usageMode VALUES ('Tandem Accelerator', 'Protron irradiation');
INSERT INTO usageMode VALUES ('Tandem Accelerator', 'He implantation');
INSERT INTO usageMode VALUES ('Tandem Accelerator', 'PITR in-situ creep');

INSERT INTO primetime VALUES ('OSIRIS S/TEM', '09:00:00', '17:00:00', 0, 0, 0, 9);
INSERT INTO primetime VALUES ('Nano SEM', '09:00:00', '17:00:00', 0, 0, 0, 24);
INSERT INTO primetime VALUES ('Nano Indentor', '09:00:00', '17:00:00', 0, 0, 0, 24);
INSERT INTO primetime VALUES ('WTS Sample Preparation', '09:00:00', '17:00:00', 0, 0, 0, 9);
INSERT INTO primetime VALUES ('Tandem Accelerator', '09:00:00', '17:00:00', 0, 0, 0, 24);
