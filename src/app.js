//#region Imports
//express
const express = require('express');
const app = express();

//body-parser
const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

//read config.json
const config = require('./config.json');

//mysql
const mysql = require('mysql');
const connection = mysql.createConnection({
    host: config.database.host,
    user: config.database.user,
    password: config.database.password,
    database: config.database.database
});

//when connection is established
connection.connect(function (err) {
    if (err) {
        console.error('error connecting: ' + err.stack);
        return;
    }
    console.log('connected as id ' + connection.threadId);
});

//express-ejs-layouts (We could utilize react and a framework which would make this easier to manage but I wanted to keep it simple)
const expressLayouts = require('express-ejs-layouts');
app.use(expressLayouts);

//express-session
const session = require('express-session');
app.use(session({
    secret: config.session.secret,
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true }
}));
//#endregion